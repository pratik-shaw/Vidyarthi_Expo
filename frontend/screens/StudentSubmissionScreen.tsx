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

  // Initialize animations
  useEffect(() => {
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
      })
    ]).start();
  }, []);

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
      case 'submitted': return '#FFA500';
      case 'reviewed': return '#2196F3';
      case 'graded': return '#4CAF50';
      case 'returned': return '#9C27B0';
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

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
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
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={60} color="#8A94A6" />
          <Text style={styles.errorTitle}>Connection Problem</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          { 
            opacity: fadeAnim,
            paddingTop: insets.top > 0 ? 0 : 20 
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={PRIMARY_COLOR} />
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
        {/* Class Info */}
        {classInfo && (
          <Animated.View
            style={[
              styles.classInfoCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <MaterialIcons name="class" size={24} color={PRIMARY_COLOR} />
            <View style={styles.classInfoText}>
              <Text style={styles.className}>{classInfo.name} {classInfo.section}</Text>
              <Text style={styles.classLabel}>Your Class</Text>
            </View>
          </Animated.View>
        )}

        {/* Quick Stats */}
        <Animated.View
          style={[
            styles.statsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{submissions.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {submissions.filter(s => s.status === 'graded').length}
            </Text>
            <Text style={styles.statLabel}>Graded</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {submissions.filter(s => s.status === 'submitted').length}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </Animated.View>

        {/* Submissions List */}
        <View style={styles.submissionsSection}>
          <Text style={styles.sectionTitle}>My Submissions</Text>
          
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
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(submission.status) }
                  ]}>
                    <Feather 
                      name={getStatusIcon(submission.status)} 
                      size={12} 
                      color="#FFFFFF" 
                    />
                  </View>
                </View>
                
                <View style={styles.submissionDetails}>
                  <View style={styles.submissionInfo}>
                    <Feather name="calendar" size={14} color="#8A94A6" />
                    <Text style={styles.submissionDate}>
                      {new Date(submission.createdAt).toLocaleDateString()}
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
                    <Feather name="award" size={14} color="#4CAF50" />
                    <Text style={styles.gradeText}>Grade: {submission.grade}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Feather name="upload" size={60} color="#8A94A6" style={{ opacity: 0.3 }} />
              <Text style={styles.emptyTitle}>No Submissions Yet</Text>
              <Text style={styles.emptyText}>
                Tap the + button to upload your first submission
              </Text>
            </View>
          )}
        </View>
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
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#F8F9FC',
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
  classInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  classInfoText: {
    marginLeft: 16,
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
  },
  classLabel: {
    fontSize: 14,
    color: '#8A94A6',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  statLabel: {
    fontSize: 14,
    color: '#8A94A6',
    marginTop: 4,
  },
  submissionsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 16,
  },
  submissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
  },
  submissionSubject: {
    fontSize: 14,
    color: '#8A94A6',
    marginTop: 4,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submissionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  submissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submissionDate: {
    fontSize: 14,
    color: '#8A94A6',
    marginLeft: 6,
  },
  submissionSize: {
    fontSize: 14,
    color: '#8A94A6',
    marginLeft: 6,
  },
  gradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F1F6',
  },
  gradeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F1F6',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#F0F1F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#3A4276',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subjectScrollView: {
    marginHorizontal: -8,
  },
  subjectCard: {
    backgroundColor: '#F0F1F6',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    minWidth: 140,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  subjectCardSelected: {
    backgroundColor: '#E8E7FF',
    borderColor: PRIMARY_COLOR,
  },
  subjectCode: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    textAlign: 'center',
  },
  subjectCodeSelected: {
    color: PRIMARY_COLOR,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    textAlign: 'center',
    marginTop: 4,
    minHeight: 36,
  },
  subjectNameSelected: {
    color: '#3A4276',
  },
  teacherName: {
    fontSize: 12,
    color: '#8A94A6',
    textAlign: 'center',
    marginTop: 4,
  },
  teacherNameSelected: {
    color: '#8A94A6',
  },
  fileSelector: {
    backgroundColor: '#F0F1F6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    borderStyle: 'dashed',
  },
  fileSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileSelectorText: {
    fontSize: 16,
    color: '#8A94A6',
    marginLeft: 12,
    flex: 1,
  },
  fileSizeText: {
    fontSize: 12,
    color: '#8A94A6',
    textAlign: 'center',
    marginTop: 8,
  },
  uploadSubmissionButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
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
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
  },
  loadingText: {
    fontSize: 16,
    color: '#8A94A6',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StudentSubmissionScreen;