import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

// Interface definitions
interface Submission {
  _id: string;
  title: string;
  studentId: {
    _id: string;
    name: string;
    email: string;
    studentId: string;
  };
  classId: {
    _id: string;
    name: string;
    section: string;
  };
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherId: {
    _id: string;
    name: string;
    email: string;
  };
  status: 'submitted' | 'reviewed' | 'graded' | 'returned';
  feedback?: string;
  grade?: string;
  pdfSize: number;
  originalFileName: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    feedback?: string;
    grade?: string;
  }>;
}

interface Props {
  studentId: string;
  classId: string;
  loading?: boolean;
  onSessionExpired: () => void;
}

const SubmissionDetailsTab: React.FC<Props> = ({ 
  studentId, 
  classId, 
  loading = false, 
  onSessionExpired 
}) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Initialize token and fetch data
  useEffect(() => {
    const initializeData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('teacherToken');
        if (storedToken) {
          setToken(storedToken);
          await fetchSubmissions(storedToken);
        } else {
          onSessionExpired();
        }
      } catch (error) {
        console.error('Error initializing submission data:', error);
        setError('Failed to load submissions');
      }
    };

    initializeData();
  }, [studentId, classId]);

  // Get authenticated API client
  const getAuthenticatedClient = (authToken: string) => {
    return axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-auth-token': authToken,
        'Content-Type': 'application/json'
      }
    });
  };

  // Fetch submissions for the specific student
  const fetchSubmissions = async (authToken = token) => {
    if (!authToken) return;

    setSubmissionsLoading(true);
    setError(null);
    
    try {
      const apiClient = getAuthenticatedClient(authToken);
      
      // Get teacher submissions and filter by student
      const response = await apiClient.get('/submissions/teacher-submissions', {
        params: {
          classId: classId,
          page: 1,
          limit: 100 // Get all submissions for this class
        }
      });

      if (response.data && response.data.submissions) {
        // Filter submissions for this specific student
        const studentSubmissions = response.data.submissions.filter(
          (submission: Submission) => submission.studentId._id === studentId
        );
        
        setSubmissions(studentSubmissions);
      } else {
        setSubmissions([]);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          onSessionExpired();
        } else if (error.response?.status === 403) {
          setError('Not authorized to view submissions for this class');
        } else {
          setError(error.response?.data?.msg || 'Failed to fetch submissions');
        }
      } else {
        setError('An unknown error occurred while fetching submissions');
      }
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchSubmissions();
  };

  // Update submission status
  const updateSubmissionStatus = async (submissionId: string, status: string, feedback?: string, grade?: string) => {
    if (!token) {
      onSessionExpired();
      return;
    }

    setUpdatingStatus(submissionId);
    
    try {
      const apiClient = getAuthenticatedClient(token);
      
      const updateData: any = { status };
      if (feedback) updateData.feedback = feedback;
      if (grade) updateData.grade = grade;

      const response = await apiClient.put(`/submissions/${submissionId}/status`, updateData);
      
      if (response.data) {
        // Update the submission in the local state
        setSubmissions(prevSubmissions => 
          prevSubmissions.map(sub => 
            sub._id === submissionId 
              ? { ...sub, ...response.data.submission }
              : sub
          )
        );
        
        Alert.alert('Success', 'Submission status updated successfully');
      }
    } catch (error) {
      console.error('Error updating submission status:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          onSessionExpired();
        } else if (error.response?.status === 403) {
          Alert.alert('Error', 'Not authorized to update this submission');
        } else {
          Alert.alert('Error', error.response?.data?.msg || 'Failed to update submission status');
        }
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Download PDF
  const downloadSubmission = async (submissionId: string, fileName: string) => {
    if (!token) {
      onSessionExpired();
      return;
    }

    try {
      const apiClient = getAuthenticatedClient(token);
      
      // Note: In a real implementation, you would handle the file download
      // For now, we'll just show an alert
      Alert.alert('Download', `This would download: ${fileName}`);
      
      // Actual implementation would be:
      // const response = await apiClient.get(`/submissions/${submissionId}/download`, {
      //   responseType: 'blob'
      // });
      // Handle the blob response for file download
      
    } catch (error) {
      console.error('Error downloading submission:', error);
      Alert.alert('Error', 'Failed to download submission');
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return '#1CB5E0';
      case 'reviewed': return '#FFA726';
      case 'graded': return '#38EF7D';
      case 'returned': return '#9C27B0';
      default: return '#8A94A6';
    }
  };

  // Show status update options
  const showStatusUpdateOptions = (submission: Submission) => {
    const statusOptions = [
      { label: 'Mark as Reviewed', value: 'reviewed' },
      { label: 'Mark as Graded', value: 'graded' },
      { label: 'Return to Student', value: 'returned' },
    ];

    const buttons = statusOptions
      .filter(option => option.value !== submission.status)
      .map(option => ({
        text: option.label,
        onPress: () => {
          if (option.value === 'graded') {
            showGradeInput(submission);
          } else {
            updateSubmissionStatus(submission._id, option.value);
          }
        }
      }));

    buttons.push({ text: 'Cancel', onPress: () => {} });

    Alert.alert('Update Status', 'Choose an action:', buttons);
  };

  // Show grade input dialog
  const showGradeInput = (submission: Submission) => {
    Alert.prompt(
      'Grade Submission',
      'Enter grade and optional feedback:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Save',
          onPress: (text) => {
            if (text && text.trim()) {
              // For simplicity, we're using the input as grade
              // In a real app, you might want separate inputs for grade and feedback
              updateSubmissionStatus(submission._id, 'graded', undefined, text.trim());
            }
          },
        },
      ],
      'plain-text',
      submission.grade || ''
    );
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Render submission card
  const renderSubmissionCard = ({ item }: { item: Submission }) => (
    <View style={styles.submissionCard}>
      <View style={styles.submissionHeader}>
        <Text style={styles.submissionTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <Text style={styles.submissionSubject}>
        {item.subjectName} ({item.subjectCode})
      </Text>
      
      <View style={styles.submissionInfo}>
        <Text style={styles.submissionInfoText}>
          <FontAwesome5 name="file-pdf" size={12} color="#F7685B" /> {item.originalFileName}
        </Text>
        <Text style={styles.submissionInfoText}>
          <FontAwesome5 name="weight" size={10} color="#8A94A6" /> {formatFileSize(item.pdfSize)}
        </Text>
      </View>
      
      <View style={styles.submissionDates}>
        <Text style={styles.submissionDate}>
          Submitted: {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        <Text style={styles.submissionDate}>
          Last Updated: {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
      
      {item.grade && (
        <View style={styles.gradeContainer}>
          <Text style={styles.gradeLabel}>Grade: </Text>
          <Text style={styles.gradeValue}>{item.grade}</Text>
        </View>
      )}
      
      {item.feedback && (
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackLabel}>Feedback:</Text>
          <Text style={styles.feedbackText}>{item.feedback}</Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => downloadSubmission(item._id, item.originalFileName)}
        >
          <FontAwesome5 name="download" size={14} color="#1CB5E0" />
          <Text style={styles.downloadButtonText}>Download</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.statusButton}
          onPress={() => showStatusUpdateOptions(item)}
          disabled={updatingStatus === item._id}
        >
          {updatingStatus === item._id ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <FontAwesome5 name="edit" size={14} color="#FFFFFF" />
              <Text style={styles.statusButtonText}>Update Status</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Show loading indicator
  if (submissionsLoading && !refreshing) {
    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Student Submissions</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1CB5E0" />
          <Text style={styles.loadingText}>Loading submissions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Student Submissions</Text>
      
      {error ? (
        <View style={styles.errorContainer}>
          <FontAwesome5 name="exclamation-circle" size={36} color="#F7685B" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => fetchSubmissions()}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : submissions.length > 0 ? (
        <FlatList
          data={submissions}
          renderItem={renderSubmissionCard}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1CB5E0', '#38EF7D']}
            />
          }
        />
      ) : (
        <View style={styles.emptyStateContainer}>
          <FontAwesome5 name="file-alt" size={36} color="#B0B7C3" />
          <Text style={styles.emptyStateText}>No submissions yet</Text>
          <Text style={styles.emptyStateSubtext}>Student submissions will appear here</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#8A94A6',
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#F7685B',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1CB5E0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  submissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  submissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submissionSubject: {
    fontSize: 14,
    color: '#8A94A6',
    marginBottom: 8,
    fontWeight: '500',
  },
  submissionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  submissionInfoText: {
    fontSize: 12,
    color: '#8A94A6',
  },
  submissionDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  submissionDate: {
    fontSize: 12,
    color: '#8A94A6',
  },
  gradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeLabel: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '500',
  },
  gradeValue: {
    fontSize: 14,
    color: '#38EF7D',
    fontWeight: '600',
  },
  feedbackContainer: {
    marginTop: 8,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
  },
  feedbackLabel: {
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '600',
    marginBottom: 4,
  },
  feedbackText: {
    fontSize: 14,
    color: '#3A4276',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  downloadButtonText: {
    color: '#1CB5E0',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1CB5E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  statusButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SubmissionDetailsTab;