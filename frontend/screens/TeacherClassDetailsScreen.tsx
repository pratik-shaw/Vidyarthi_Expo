import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { API_BASE_URL} from '../config/api';

// API URL with configurable timeout
const API_URL = API_BASE_URL; // Change this to your server IP/domain
const API_TIMEOUT = 15000; // 15 seconds timeout
const { width } = Dimensions.get('window');

// Types
type TeacherClassDetailsParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherClassDetails'>;

interface Teacher {
  _id: string;
  name: string;
  email: string;
}

interface Student {
  _id: string;
  name: string;
  studentId: string;
  email?: string;
  phone?: string;
  uniqueId?: string;
}

interface ClassDetails {
  _id: string;
  name: string;
  section: string;
  grade?: string;
  teacherIds: Teacher[];
  studentIds: Student[];
  schoolId?: string;
}

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
}

const TeacherClassDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  // Route params
  const { classId, className } = route.params as TeacherClassDetailsParams;
  
  // State management
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [studentsLoading, setStudentsLoading] = useState<boolean>(false);

  // Set navigation header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: className || 'Class Details',
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2C3E50',
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
      },
      headerBackTitle: 'Back',
    });
  }, [navigation, className]);

  // Network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
      });
    });

    return () => unsubscribe();
  }, []);

  // Initialize component
  useEffect(() => {
    initializeScreen();
  }, [classId]);

  const initializeScreen = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('teacherToken');
      
      if (!storedToken) {
        handleSessionExpired();
        return;
      }
      
      setToken(storedToken);
      await fetchClassDetails(storedToken);
    } catch (error) {
      console.error('Error initializing screen:', error);
      setError('Failed to initialize screen');
      setLoading(false);
    }
  };

  // Create authenticated API client
  const createApiClient = useCallback((authToken: string) => {
    return axios.create({
      baseURL: API_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-auth-token': authToken,
        'Content-Type': 'application/json',
      },
    });
  }, []);

  // Fetch class details
  const fetchClassDetails = async (authToken: string = token!) => {
    if (!authToken) {
      handleSessionExpired();
      return;
    }

    if (!networkState.isConnected) {
      setError('No internet connection. Please check your network and try again.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(!refreshing);
      setError(null);

      const apiClient = createApiClient(authToken);
      const response = await apiClient.get(`/class/${classId}`);
      
      if (response.data) {
        setClassDetails(response.data);
        console.log('Class details loaded:', response.data);
      } else {
        throw new Error('No data received from server');
      }
    } catch (error) {
      console.error('Error fetching class details:', error);
      handleApiError(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle API errors
  const handleApiError = (error: any) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        handleSessionExpired();
      } else if (error.response?.status === 404) {
        setError('Class not found. Please check if the class still exists.');
      } else if (error.code === 'ECONNABORTED') {
        setError('Request timeout. Please try again.');
      } else {
        const message = error.response?.data?.msg || error.response?.data?.message || 'Failed to load class details';
        setError(message);
      }
    } else {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  // Handle session expiration
  const handleSessionExpired = () => {
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please login again.',
      [
        {
          text: 'OK',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('teacherToken');
              navigation.reset({
                index: 0,
                routes: [{ name: 'TeacherLogin' }],
              });
            } catch (error) {
              console.error('Error clearing storage:', error);
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  // Handle pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClassDetails();
  }, [token]);

  // Navigate to student details
  const handleViewStudentDetails = (student: Student) => {
    navigation.navigate('TeacherStudentDetailsScreen', {
      studentId: student._id,
      studentName: student.name,
      classId: classId,
      className: className,
    });
  };

  // Navigate to scoring screen
  const handleAddMarks = () => {
    navigation.navigate('TeacherScoring', {
      classId: classId,
      className: className,
    });
  };

  // Navigate to event calendar
  const handleViewSchedule = () => {
    navigation.navigate('TeacherEventCalendar', {
      classId: classId,
      className: className,
    });
  };

  const handleViewReports = () => {
  navigation.navigate('TeacherSubjectReport', {
    subjectId: classDetails?._id || classId, // Using classId as subjectId if not available
    subjectName: classDetails?.name || className,
    classId: classId,
    className: className,
  });
};

const handlePostMaterials = () => {
  navigation.navigate('TeacherPostMaterial', {
    subjectId: classDetails?._id || classId,
    subjectName: classDetails?.name || className,
    classId: classId,
    className: className,
  });
};


  // Show coming soon alerts
  const showComingSoon = (feature: string) => {
    Alert.alert(
      'Coming Soon',
      `${feature} feature is under development and will be available in a future update.`,
      [{ text: 'OK' }]
    );
  };

  // Render student item
  const renderStudentItem = ({ item, index }: { item: Student; index: number }) => (
    <View style={[styles.studentRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.name}</Text>
        <Text style={styles.studentId}>ID: {item.studentId || `ST${1000 + index + 1}`}</Text>
        <Text style={styles.studentEmail}>{item.email || 'No email provided'}</Text>
      </View>
      <TouchableOpacity
        style={styles.viewButton}
        onPress={() => handleViewStudentDetails(item)}
        activeOpacity={0.7}
      >
        <Feather name="eye" size={16} color="#FFFFFF" />
        <Text style={styles.viewButtonText}>View</Text>
      </TouchableOpacity>
    </View>
  );

  // Render teacher item
  const renderTeacherItem = ({ item }: { item: Teacher }) => (
    <View style={styles.teacherCard}>
      <View style={styles.teacherIcon}>
        <FontAwesome5 name="user-tie" size={18} color="#FFFFFF" />
      </View>
      <View style={styles.teacherInfo}>
        <Text style={styles.teacherName}>{item.name}</Text>
        <Text style={styles.teacherEmail}>{item.email}</Text>
      </View>
    </View>
  );

  // Render action button
  const renderActionButton = (
    icon: string,
    title: string,
    onPress: () => void,
    backgroundColor: string,
    iconColor: string = '#FFFFFF'
  ) => (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <FontAwesome5 name={icon} size={20} color={iconColor} />
      <Text style={[styles.actionButtonText, { color: iconColor }]}>{title}</Text>
    </TouchableOpacity>
  );

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
          <Text style={styles.loadingText}>Loading class details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !classDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContainer}>
          <FontAwesome5 name="exclamation-triangle" size={48} color="#E74C3C" />
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchClassDetails()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3498DB', '#2ECC71']}
            tintColor="#3498DB"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Class Header Card */}
        <View style={styles.headerCard}>
          <LinearGradient
            colors={['#3498DB', '#2ECC71']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.classIconContainer}>
                <FontAwesome5 name="chalkboard-teacher" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.classInfo}>
                <Text style={styles.classTitle}>{classDetails?.name || 'Unknown Class'}</Text>
                <Text style={styles.classSection}>Section {classDetails?.section || 'N/A'}</Text>
                <View style={styles.studentCountContainer}>
                  <FontAwesome5 name="users" size={14} color="#FFFFFF" />
                  <Text style={styles.studentCount}>
                    {classDetails?.studentIds?.length || 0} Students
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {renderActionButton('poll', 'Add Marks', handleAddMarks, '#3498DB')}
            {renderActionButton('file-alt', 'Materials', handlePostMaterials, '#9B59B6')}
            {renderActionButton('chart-bar', 'Reports', handleViewReports, '#E67E22')}
            {renderActionButton('calendar', 'Schedule', handleViewSchedule, '#1ABC9C')}
          </View>
        </View>

        {/* Teachers Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teachers</Text>
          {classDetails?.teacherIds && classDetails.teacherIds.length > 0 ? (
            <FlatList
              data={classDetails.teacherIds}
              renderItem={renderTeacherItem}
              keyExtractor={(item, index) => `teacher-${item._id}-${index}`}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome5 name="user-slash" size={32} color="#BDC3C7" />
              <Text style={styles.emptyStateText}>No teachers assigned</Text>
            </View>
          )}

        </View>

        {/* Students Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Students</Text>
          {classDetails?.studentIds && classDetails.studentIds.length > 0 ? (
            <View style={styles.studentsContainer}>
              <FlatList
                data={classDetails.studentIds}
                renderItem={renderStudentItem}
                keyExtractor={(item, index) => `student-${item._id}-${index}`}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome5 name="user-graduate" size={32} color="#BDC3C7" />
              <Text style={styles.emptyStateText}>No students enrolled</Text>
              <Text style={styles.emptyStateSubtext}>
                Students will appear here once they enroll in the class
              </Text>
            </View>
          )}
        
        </View> 

        {/* Communication Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication</Text>
          <View style={styles.communicationGrid}>
            <TouchableOpacity
              style={styles.communicationCard}
              onPress={() => showComingSoon('Class Chat')}
              activeOpacity={0.8}
            >
              <View style={[styles.communicationIcon, { backgroundColor: '#E74C3C' }]}>
                <FontAwesome5 name="comments" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.communicationTitle}>Class Chat</Text>
              <Text style={styles.communicationSubtitle}>Message students & parents</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.communicationCard}
              onPress={() => showComingSoon('Announcements')}
              activeOpacity={0.8}
            >
              <View style={[styles.communicationIcon, { backgroundColor: '#F39C12' }]}>
                <FontAwesome5 name="bullhorn" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.communicationTitle}>Announcements</Text>
              <Text style={styles.communicationSubtitle}>Send class updates</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Add your existing styles here
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerCard: {
    margin: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerGradient: {
    borderRadius: 16,
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  classInfo: {
    flex: 1,
  },
  classTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  classSection: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  studentCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentCount: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 6,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: (width - 48) / 2,
    backgroundColor: '#3498DB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  teacherCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  teacherIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teacherInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  teacherEmail: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 2,
  },
  studentsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  evenRow: {
    backgroundColor: '#FFFFFF',
  },
  oddRow: {
    backgroundColor: '#F8F9FC',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  studentId: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 2,
  },
  studentEmail: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 2,
  },
  viewButton: {
    backgroundColor: '#3498DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginHorizontal: 16,
  },
  communicationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  communicationCard: {
    width: (width - 48) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  communicationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  communicationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    textAlign: 'center',
  },
  communicationSubtitle: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#7F8C8D',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#BDC3C7',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#7F8C8D',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#3498DB',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TeacherClassDetailsScreen;