// StudentSubmissionScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
  Platform,
  TextInput,
  Modal
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { RootStackParamList } from '../App';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { STUDENT_API } from '../config/api';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#4F46E5';

// API configuration
const apiClient = axios.create({
  baseURL: STUDENT_API,
  timeout: 30000, // 30 seconds for file uploads
});

// Add token interceptor
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('studentToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token for request:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

interface Subject {
  _id: string;
  name: string;
  code: string;
  description?: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  };
}

interface Submission {
  _id: string;
  title: string;
  status: 'submitted' | 'reviewed' | 'graded' | 'returned';
  subjectName: string;
  subjectCode: string;
  createdAt: string;
  teacherFeedback?: string;
  grade?: string;
  originalFileName: string;
  pdfSize: number;
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

const StudentSubmissionScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Upload form state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  // Initialize animations
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    
    startAnimations();
  }, [navigation]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ]).start();
  };

  // Fetch data when screen focuses
  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [])
  );

  // Fetch all required data
  const fetchData = async () => {
    setError(null);
    setIsLoading(true);
    
    try {
      await Promise.all([
        fetchSubjects(),
        fetchMySubmissions()
      ]);
    } catch (err) {
      console.error('Error fetching data:', err);
      handleApiError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available subjects
  const fetchSubjects = async () => {
    try {
      const response = await apiClient.get('/api/submissions/subjects');
      setSubjects(response.data.subjects || []);
      setClassInfo(response.data.classInfo || null);
    } catch (err) {
      console.error('Error fetching subjects:', err);
      throw err;
    }
  };

  // Fetch student's submissions
  const fetchMySubmissions = async () => {
    try {
      const response = await apiClient.get('/api/submissions/my-submissions', {
        params: {
          page: 1,
          limit: 20
        }
      });
      setSubmissions(response.data.submissions || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      throw err;
    }
  };

  // Handle API errors
  const handleApiError = (error: any) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        handleUnauthorizedError();
      } else if (error.response?.status === 403) {
        setError('Access denied. Please contact your administrator.');
      } else if (error.code === 'ECONNABORTED') {
        setError('Request timeout. Please try again.');
      } else if (error.response) {
        setError(error.response.data?.msg || `Server error (${error.response.status})`);
      } else if (error.request) {
        setError('Could not reach the server. Please check your connection.');
      } else {
        setError('An error occurred with the request.');
      }
    } else {
      setError('An unexpected error occurred.');
    }
  };

  // Handle unauthorized errors
  const handleUnauthorizedError = async () => {
    try {
      await AsyncStorage.multiRemove(['studentToken', 'studentData']);
      Alert.alert(
        "Session Expired",
        "Your session has expired. Please log in again.",
        [{ text: "OK", onPress: () => navigation.replace('StudentLogin') }]
      );
    } catch (err) {
      console.error("Error clearing storage:", err);
      navigation.replace('StudentLogin');
    }
  };

  // Pull to refresh
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchData().finally(() => {
      setRefreshing(false);
    });
  }, []);

  // Handle file selection
  const handleFileSelection = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Check file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size && file.size > maxSize) {
          Alert.alert('File Too Large', 'Please select a PDF file smaller than 10MB.');
          return;
        }

        setSelectedFile(result);
      }
    } catch (err) {
      console.error('Error selecting file:', err);
      Alert.alert('Error', 'Failed to select file. Please try again.');
    }
  };

  // Handle submission upload
  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      Alert.alert('Missing Information', 'Please enter a title for your submission.');
      return;
    }

    if (!selectedSubject) {
      Alert.alert('Missing Information', 'Please select a subject for your submission.');
      return;
    }

    if (!selectedFile || !selectedFile.assets || selectedFile.assets.length === 0) {
      Alert.alert('Missing File', 'Please select a PDF file to upload.');
      return;
    }

    setIsUploading(true);

    try {
      const file = selectedFile.assets[0];
      
      // Create FormData
      const formData = new FormData();
      formData.append('title', uploadTitle.trim());
      formData.append('classId', classInfo?.id || '');
      formData.append('subjectId', selectedSubject._id);
      
      // Add file to FormData
      formData.append('pdf', {
        uri: file.uri,
        type: file.mimeType || 'application/pdf',
        name: file.name
      } as any);

      // Upload submission
      const response = await apiClient.post('/api/submissions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds for upload
      });

      Alert.alert(
        'Success',
        'Your submission has been uploaded successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowUploadModal(false);
              resetUploadForm();
              fetchMySubmissions(); // Refresh submissions list
            }
          }
        ]
      );

    } catch (err) {
      console.error('Error uploading submission:', err);
      
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.msg || 'Failed to upload submission. Please try again.';
        Alert.alert('Upload Failed', message);
      } else {
        Alert.alert('Upload Failed', 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Reset upload form
  const resetUploadForm = () => {
    setUploadTitle('');
    setSelectedSubject(null);
    setSelectedFile(null);
  };

  // Handle submission item press
  const handleSubmissionPress = (submission: Submission) => {
    // Navigate to submission details or show options
    Alert.alert(
      submission.title,
      `Status: ${submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}\nSubject: ${submission.subjectName}\nUploaded: ${new Date(submission.createdAt).toLocaleDateString()}${submission.teacherFeedback ? `\n\nFeedback: ${submission.teacherFeedback}` : ''}${submission.grade ? `\nGrade: ${submission.grade}` : ''}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Download', onPress: () => handleDownload(submission._id) }
      ]
    );
  };

  // Handle download
  const handleDownload = async (submissionId: string) => {
    try {
      // For now, just show an info message
      // In a real implementation, you would handle the file download
      Alert.alert('Download', 'Download functionality will be implemented based on your file handling requirements.');
    } catch (err) {
      console.error('Error downloading file:', err);
      Alert.alert('Error', 'Failed to download file.');
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return '#F59E0B';
      case 'reviewed': return '#2196F3';
      case 'graded': return '#22C55E';
      case 'returned': return '#8B5CF6';
      default: return '#8A94A6';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted': return 'upload';
      case 'reviewed': return 'eye';
      case 'graded': return 'award';
      case 'returned': return 'corner-down-left';
      default: return 'file';
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderHeader = () => (
    <Animated.View 
      style={[
        styles.header,
        { 
          opacity: headerOpacity,
          paddingTop: insets.top > 0 ? 0 : 20 
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={24} color={PRIMARY_COLOR} />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>Submissions</Text>
      
      <TouchableOpacity 
        style={styles.uploadButton}
        onPress={() => setShowUploadModal(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderOverallStats = () => (
    <Animated.View
      style={[
        styles.statsContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <LinearGradient
        colors={[PRIMARY_COLOR, '#6366F1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.mainStatsCard}
      >
        <Text style={styles.mainStatsTitle}>Total Submissions</Text>
        <Text style={styles.mainStatsPercentage}>
          {submissions.length}
        </Text>
        <Text style={styles.mainStatsSubtitle}>
          {classInfo ? `${classInfo.name} ${classInfo.section}` : 'My Submissions'}
        </Text>
      </LinearGradient>

      <View style={styles.subStatsContainer}>
        <View style={styles.subStatsCard}>
          <View style={[styles.subStatsIcon, { backgroundColor: '#22C55E15' }]}>
            <Feather name="award" size={20} color="#22C55E" />
          </View>
          <Text style={styles.subStatsValue}>
            {submissions.filter(s => s.status === 'graded').length}
          </Text>
          <Text style={styles.subStatsLabel}>Graded</Text>
        </View>
        
        <View style={styles.subStatsCard}>
          <View style={[styles.subStatsIcon, { backgroundColor: '#F59E0B15' }]}>
            <Feather name="clock" size={20} color="#F59E0B" />
          </View>
          <Text style={styles.subStatsValue}>
            {submissions.filter(s => s.status === 'submitted').length}
          </Text>
          <Text style={styles.subStatsLabel}>Pending</Text>
        </View>
        
        <View style={styles.subStatsCard}>
          <View style={[styles.subStatsIcon, { backgroundColor: '#2196F315' }]}>
            <Feather name="eye" size={20} color="#2196F3" />
          </View>
          <Text style={styles.subStatsValue}>
            {submissions.filter(s => s.status === 'reviewed').length}
          </Text>
          <Text style={styles.subStatsLabel}>Reviewed</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderSubmissionsList = () => (
    <Animated.View
      style={[
        styles.section,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.sectionHeaderContainer}>
        <Text style={styles.sectionTitle}>Recent Submissions</Text>
      </View>
      
      {submissions.length > 0 ? (
        submissions.map((submission) => (
          <TouchableOpacity
            key={submission._id}
            style={styles.submissionCard}
            onPress={() => handleSubmissionPress(submission)}
            activeOpacity={0.7}
          >
            <View style={styles.submissionHeader}>
              <View style={styles.submissionTitleContainer}>
                <Text style={styles.submissionTitle} numberOfLines={1}>
                  {submission.title}
                </Text>
                <Text style={styles.submissionSubject}>
                  {submission.subjectName} ({submission.subjectCode})
                </Text>
              </View>
              <View style={[
                styles.statusIcon,
                { backgroundColor: `${getStatusColor(submission.status)}15` }
              ]}>
                <Feather 
                  name={getStatusIcon(submission.status)} 
                  size={16} 
                  color={getStatusColor(submission.status)} 
                />
              </View>
            </View>
            
            <View style={styles.submissionDetails}>
              <View style={styles.submissionInfo}>
                <Feather name="calendar" size={14} color="#8A94A6" />
                <Text style={styles.submissionDate}>
                  {new Date(submission.createdAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </View>
              <View style={styles.submissionInfo}>
                <Feather name="file" size={14} color="#8A94A6" />
                <Text style={styles.submissionSize}>
                  {formatFileSize(submission.pdfSize)}
                </Text>
              </View>
            </View>

            {submission.grade && (
              <View style={styles.gradeContainer}>
                <View style={[styles.gradeIcon, { backgroundColor: '#22C55E15' }]}>
                  <Feather name="award" size={14} color="#22C55E" />
                </View>
                <Text style={styles.gradeText}>Grade: {submission.grade}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Feather name="upload" size={48} color="#8A94A6" style={{ opacity: 0.3 }} />
          </View>
          <Text style={styles.emptyTitle}>No Submissions Yet</Text>
          <Text style={styles.emptyText}>
            Tap the + button to upload your first submission
          </Text>
        </View>
      )}
    </Animated.View>
  );

  // Loading state
  if (isLoading && !submissions.length) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading submissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && subjects.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={60} color="#8A94A6" />
          <Text style={styles.errorTitle}>Unable to Load Data</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchData}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      {renderHeader()}

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
      >
        {renderOverallStats()}
        {renderSubmissionsList()}
      </ScrollView>

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Submission</Text>
              <TouchableOpacity
                onPress={() => setShowUploadModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#8A94A6" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.textInput}
                  value={uploadTitle}
                  onChangeText={setUploadTitle}
                  placeholder="Enter submission title..."
                  placeholderTextColor="#8A94A6"
                />
              </View>

              {/* Subject Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Subject *</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.subjectScrollView}
                >
                  {subjects.map((subject) => (
                    <TouchableOpacity
                      key={subject._id}
                      style={[
                        styles.subjectCard,
                        selectedSubject?._id === subject._id && styles.subjectCardSelected
                      ]}
                      onPress={() => setSelectedSubject(subject)}
                    >
                      <Text style={[
                        styles.subjectCode,
                        selectedSubject?._id === subject._id && styles.subjectCodeSelected
                      ]}>
                        {subject.code}
                      </Text>
                      <Text style={[
                        styles.subjectName,
                        selectedSubject?._id === subject._id && styles.subjectNameSelected
                      ]} numberOfLines={2}>
                        {subject.name}
                      </Text>
                      <Text style={[
                        styles.teacherName,
                        selectedSubject?._id === subject._id && styles.teacherNameSelected
                      ]}>
                        {subject.teacher.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* File Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>PDF File *</Text>
                <TouchableOpacity
                  style={styles.fileSelector}
                  onPress={handleFileSelection}
                >
                  <View style={styles.fileSelectorContent}>
                    <Feather name="upload" size={24} color={PRIMARY_COLOR} />
                    <Text style={styles.fileSelectorText}>
                      {selectedFile && selectedFile.assets && selectedFile.assets[0]
                        ? selectedFile.assets[0].name
                        : 'Select PDF file (Max 10MB)'
                      }
                    </Text>
                  </View>
                  {selectedFile && selectedFile.assets && selectedFile.assets[0] && (
                    <Text style={styles.fileSizeText}>
                      {formatFileSize(selectedFile.assets[0].size || 0)}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Upload Button */}
            <TouchableOpacity
              style={[
                styles.uploadSubmissionButton,
                isUploading && styles.uploadSubmissionButtonDisabled
              ]}
              onPress={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="upload" size={20} color="#FFFFFF" />
                  <Text style={styles.uploadSubmissionButtonText}>Upload Submission</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#F8F9FC',
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
    flex: 1,
    textAlign: 'center',
  },
  uploadButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  statsContainer: {
    marginBottom: 30,
  },
  mainStatsCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mainStatsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 8,
  },
  mainStatsPercentage: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mainStatsSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  subStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  subStatsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  subStatsIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  subStatsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
    marginBottom: 4,
  },
  subStatsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8A94A6',
  },
  section: {
    marginBottom: 30,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
  },
  submissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  submissionTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  submissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  submissionSubject: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A94A6',
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submissionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  submissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  submissionDate: {
    fontSize: 13,
    color: '#8A94A6',
    fontWeight: '500',
  },
  submissionSize: {
    fontSize: 13,
    color: '#8A94A6',
    fontWeight: '500',
  },
  gradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E0A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  gradeIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  gradeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#8A94A6',
    marginTop: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#3A4276',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subjectScrollView: {
    marginTop: 8,
  },
  subjectCard: {
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  subjectCardSelected: {
    backgroundColor: `${PRIMARY_COLOR}15`,
    borderColor: PRIMARY_COLOR,
  },
  subjectCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8A94A6',
    marginBottom: 4,
    textAlign: 'center',
  },
  subjectCodeSelected: {
    color: PRIMARY_COLOR,
  },
  subjectName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A4276',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 16,
  },
  subjectNameSelected: {
    color: PRIMARY_COLOR,
  },
  teacherName: {
    fontSize: 11,
    color: '#8A94A6',
    textAlign: 'center',
  },
  teacherNameSelected: {
    color: PRIMARY_COLOR,
  },
  fileSelector: {
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  fileSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileSelectorText: {
    fontSize: 16,
    color: '#8A94A6',
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  fileSizeText: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 8,
    fontWeight: '500',
  },
  uploadSubmissionButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadSubmissionButtonDisabled: {
    backgroundColor: '#8A94A6',
    shadowOpacity: 0,
    elevation: 0,
  },
  uploadSubmissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StudentSubmissionScreen;