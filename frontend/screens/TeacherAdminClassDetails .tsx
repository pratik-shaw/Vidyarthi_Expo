import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState } from 'react';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { API_BASE_URL } from '../config/api';

const { width } = Dimensions.get('window');
const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000;

type TeacherAdminClassDetailsParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAdminClassDetails'>;

interface Teacher {
  _id: string;
  name: string;
  email: string;
  subject?: string;
}

interface Student {
  _id: string;
  name: string;
  studentId: string;
  email?: string;
  phone?: string;
  parentContact?: string;
  attendance?: {
    present: number;
    absent: number;
    percentage: number;
  };
  isActive?: boolean;
}

interface ClassDetails {
  _id: string;
  name: string;
  section: string;
  grade?: string;
  teacherIds: Teacher[];
  studentIds: Student[];
  schoolId?: string;
  schedule?: string;
  room?: string;
  description?: string;
}

const TeacherAdminClassDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { classId, className } = route.params as unknown as TeacherAdminClassDetailsParams;
  
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `Class Management`,
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2C3E50',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
      },
    });
  }, [navigation, className]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('teacherToken');
        if (!storedToken) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'TeacherLogin' }],
          });
          return;
        }
        setToken(storedToken);
        fetchClassDetails(storedToken);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data');
        setLoading(false);
      }
    };
    loadData();
  }, [classId]);

  // Filter students based on search query
  useEffect(() => {
    if (!classDetails?.studentIds) {
      setFilteredStudents([]);
      return;
    }

    if (!searchQuery.trim()) {
      setFilteredStudents(classDetails.studentIds);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = classDetails.studentIds.filter((student) => {
      const nameMatch = student.name?.toLowerCase().includes(query);
      const idMatch = student.studentId?.toLowerCase().includes(query);
      const emailMatch = student.email?.toLowerCase().includes(query);
      
      return nameMatch || idMatch || emailMatch;
    });

    setFilteredStudents(filtered);
  }, [searchQuery, classDetails?.studentIds]);

  const getAuthenticatedClient = (authToken = token) => {
    return axios.create({
      baseURL: API_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-auth-token': authToken,
        'Content-Type': 'application/json'
      }
    });
  };

  const fetchClassDetails = async (authToken = token) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!authToken) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'TeacherLogin' }],
        });
        return;
      }

      if (!isConnected) {
        setError('No internet connection. Please check your network.');
        setLoading(false);
        return;
      }

      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/teacher/admin-class`);
      
      const transformedData = {
        _id: response.data.adminClass._id,
        name: response.data.adminClass.name,
        section: response.data.adminClass.section,
        grade: response.data.adminClass.grade,
        teacherIds: response.data.teachers || [],
        studentIds: response.data.students || [],
        schedule: response.data.adminClass.schedule || '',
        room: response.data.adminClass.room || '',
        description: response.data.adminClass.description || ''
      };
      
      setClassDetails(transformedData);
    } catch (error) {
      console.error('Error fetching admin class details:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else if (error.response?.status === 404) {
          setError('No admin class assigned to you or class not found');
        } else {
          setError(`Error: ${error.response?.data?.msg || 'Failed to fetch class details'}`);
        }
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchClassDetails();
  };

  const handleSessionExpired = () => {
    Alert.alert(
      "Session Expired",
      "Your session has expired. Please login again.",
      [
        {
          text: "OK",
          onPress: async () => {
            await AsyncStorage.removeItem('teacherToken');
            navigation.reset({
              index: 0,
              routes: [{ name: 'TeacherLogin' }],
            });
          }
        }
      ]
    );
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleQuickAction = (actionId: string) => {
    switch (actionId) {
      case 'take_attendance':
        navigation.navigate('TeacherAdminTakeAttendance', {
          classId: classId,
          className: className,
        });
        break;
      case 'view_reports':
        navigation.navigate('TeacherAdminStudentReportCard', {
          classId: classDetails?._id || classId,
          className: classDetails?.name || className,
          studentId: '',
          studentName: ''
        });
        break;
      case 'add_materials':
        navigation.navigate('TeacherPostMaterial', {
          subjectId: classDetails?._id || classId,
          subjectName: classDetails?.name || className,
          classId: classId,
          className: className,
        });
        break;
      case 'schedule_events_dates':
        navigation.navigate('TeacherEventCalendar', {
          classId: classId,
          className: className,
        });
        break;
      case 'scoring':
        navigation.navigate('TeacherScoring', {
          classId: classId,
          className: className
        });
        break;
      case 'announcements':
        Alert.alert("Coming Soon", "Announcements feature is under development.");
        break;
      case 'chat_room':
        Alert.alert("Coming Soon", "Chat room feature is under development.");
        break;
      default:
        Alert.alert("Coming Soon", "This feature is under development.");
    }
  };

  const navigateToMoreOption = (screen: string) => {
    switch (screen) {
      case 'attendance_sheet':
        navigation.navigate('TeacherAttendanceSheet', {
          classId: classDetails?._id || classId,
          className: classDetails?.name || className,
        });
        break;
      case 'subject_report':
        navigation.navigate('TeacherSubjectReport', {
          subjectId: classDetails?._id || classId,
          subjectName: classDetails?.name || className,
          classId: classId,
          className: className,
        });
        break;
      case 'academic_records':
        navigation.navigate('TeacherAdminStudentAcademicSheet', {
          classId: classDetails?._id || classId,
          className: classDetails?.name || className,
          studentId: '',
          studentName: ''
        });
        break;
      case 'subjects':
        navigation.navigate('TeacherAdminSubjects', {
          classId: classDetails?._id || classId,
          className: classDetails?.name || className
        });
        break;
      case 'exams':
        navigation.navigate('TeacherAdminExams', {
          classId: classId,
          className: className
        });
        break;
    }
  };

  const handleViewStudentDetails = (student: Student) => {
    navigation.navigate('TeacherStudentDetailsScreen', {
      studentId: student._id,
      studentName: student.name,
      classId: classDetails?._id || classId,
      className: classDetails?.name || className,
    });
  };

  const renderActionButton = (
    icon: string,
    title: string,
    onPress: () => void,
    backgroundColor: string
  ) => (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <FontAwesome5 name={icon} size={20} color="#FFFFFF" />
      <Text style={styles.actionButtonText}>{title}</Text>
    </TouchableOpacity>
  );

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

  if (error) {
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
                <FontAwesome5 name="graduation-cap" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.classInfo}>
                <Text style={styles.classTitle}>{classDetails?.name || className}</Text>
                <Text style={styles.classSection}>Section {classDetails?.section}</Text>
                <View style={styles.studentCountContainer}>
                  <FontAwesome5 name="users" size={14} color="#FFFFFF" />
                  <Text style={styles.studentCount}>
                    {classDetails?.studentIds?.length || 0} Students
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.adminBadge}>
              <FontAwesome5 name="crown" size={12} color="#FFD700" />
              <Text style={styles.adminBadgeText}>CLASS ADMIN</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Actions - Daily Use */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityText}>DAILY</Text>
            </View>
          </View>
          
          <View style={styles.actionsGrid}>
            {renderActionButton('clipboard-check', 'Attendance', () => handleQuickAction('take_attendance'), '#3498DB')}
            {renderActionButton('poll', 'Add Marks', () => handleQuickAction('scoring'), '#E74C3C')}
            {renderActionButton('chart-line', 'Reports', () => handleQuickAction('view_reports'), '#E67E22')}
            {renderActionButton('calendar-alt', 'Schedule', () => handleQuickAction('schedule_events_dates'), '#1ABC9C')}
          </View>
        </View>

        {/* Communication Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication</Text>
          
          <View style={styles.communicationGrid}>
            <TouchableOpacity
              style={styles.communicationCard}
              onPress={() => handleQuickAction('announcements')}
              activeOpacity={0.8}
            >
              <View style={[styles.communicationIcon, { backgroundColor: '#F39C12' }]}>
                <FontAwesome5 name="bullhorn" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.communicationTitle}>Announcements</Text>
              <Text style={styles.communicationSubtitle}>Send class updates</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.communicationCard}
              onPress={() => handleQuickAction('chat_room')}
              activeOpacity={0.8}
            >
              <View style={[styles.communicationIcon, { backgroundColor: '#8E44AD' }]}>
                <FontAwesome5 name="comments" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.communicationTitle}>Class Chat</Text>
              <Text style={styles.communicationSubtitle}>Message students</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.communicationCard}
              onPress={() => handleQuickAction('add_materials')}
              activeOpacity={0.8}
            >
              <View style={[styles.communicationIcon, { backgroundColor: '#27AE60' }]}>
                <FontAwesome5 name="folder-plus" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.communicationTitle}>Materials</Text>
              <Text style={styles.communicationSubtitle}>Upload resources</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Academic Records */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic Records</Text>
          
          <TouchableOpacity
            style={styles.recordCard}
            onPress={() => navigateToMoreOption('attendance_sheet')}
            activeOpacity={0.8}
          >
            <View style={[styles.recordIcon, { backgroundColor: '#EBF4FF' }]}>
              <FontAwesome5 name="clipboard-list" size={20} color="#3498DB" />
            </View>
            <View style={styles.recordContent}>
              <Text style={styles.recordTitle}>Attendance Sheet</Text>
              <Text style={styles.recordSubtitle}>View & manage attendance records</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#BDC3C7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.recordCard}
            onPress={() => navigateToMoreOption('academic_records')}
            activeOpacity={0.8}
          >
            <View style={[styles.recordIcon, { backgroundColor: '#FFFAF0' }]}>
              <FontAwesome5 name="graduation-cap" size={20} color="#E67E22" />
            </View>
            <View style={styles.recordContent}>
              <Text style={styles.recordTitle}>Academic Records</Text>
              <Text style={styles.recordSubtitle}>Subject-wise performance</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#BDC3C7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.recordCard}
            onPress={() => navigateToMoreOption('subject_report')}
            activeOpacity={0.8}
          >
            <View style={[styles.recordIcon, { backgroundColor: '#F0FFF4' }]}>
              <FontAwesome5 name="book-open" size={20} color="#2ECC71" />
            </View>
            <View style={styles.recordContent}>
              <Text style={styles.recordTitle}>Your Subject Report</Text>
              <Text style={styles.recordSubtitle}>Teaching subject analysis</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#BDC3C7" />
          </TouchableOpacity>
        </View>

        {/* Class Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Class Configuration</Text>
          
          <TouchableOpacity
            style={styles.recordCard}
            onPress={() => navigateToMoreOption('subjects')}
            activeOpacity={0.8}
          >
            <View style={[styles.recordIcon, { backgroundColor: '#FDF2F8' }]}>
              <FontAwesome5 name="book" size={20} color="#EC4899" />
            </View>
            <View style={styles.recordContent}>
              <Text style={styles.recordTitle}>Subjects & Teachers</Text>
              <Text style={styles.recordSubtitle}>Manage subject assignments</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#BDC3C7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.recordCard}
            onPress={() => navigateToMoreOption('exams')}
            activeOpacity={0.8}
          >
            <View style={[styles.recordIcon, { backgroundColor: '#FEF2F2' }]}>
              <FontAwesome5 name="clipboard" size={20} color="#EF4444" />
            </View>
            <View style={styles.recordContent}>
              <Text style={styles.recordTitle}>Examinations</Text>
              <Text style={styles.recordSubtitle}>Manage exams & assessments</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#BDC3C7" />
          </TouchableOpacity>
        </View>

        {/* Teachers Section */}
        {classDetails?.teacherIds && classDetails.teacherIds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Teaching Staff</Text>
            
            {classDetails.teacherIds.map((teacher, index) => (
              <View key={teacher._id || index} style={styles.teacherCard}>
                <View style={styles.teacherIcon}>
                  <FontAwesome5 name="user-tie" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.teacherInfo}>
                  <Text style={styles.teacherName}>{teacher.name}</Text>
                  <Text style={styles.teacherEmail}>{teacher.email}</Text>
                </View>
                {teacher.subject && (
                  <View style={styles.subjectTag}>
                    <Text style={styles.subjectTagText}>{teacher.subject}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Search Bar */}
        {classDetails?.studentIds && classDetails.studentIds.length > 0 && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Feather name="search" size={20} color="#7F8C8D" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search students by name, ID, or email..."
                placeholderTextColor="#BDC3C7"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearSearch}
                  style={styles.clearButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={20} color="#7F8C8D" />
                </TouchableOpacity>
              )}
            </View>
            {searchQuery.length > 0 && (
              <Text style={styles.searchResultText}>
                Found {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        )}

        {/* Students Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Students</Text>
          
          {classDetails?.studentIds && classDetails.studentIds.length > 0 ? (
            <View style={styles.studentsContainer}>
              {filteredStudents.map((student, index) => (
                <View key={student._id || index} style={[styles.studentRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentId}>ID: {student.studentId || `ST${1000 + index + 1}`}</Text>
                    <Text style={styles.studentEmail}>{student.email || 'No email provided'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => handleViewStudentDetails(student)}
                    activeOpacity={0.7}
                  >
                    <Feather name="eye" size={16} color="#FFFFFF" />
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome5 name="user-graduate" size={32} color="#BDC3C7" />
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'No students found' : 'No students enrolled'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Students will appear here once they enroll'
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Container & Base Styles
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FC',
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header Card Styles
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
    marginBottom: 16,
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
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginLeft: 6,
  },

  // Section Styles
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -2,
    marginTop: 10
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  priorityBadge: {
    backgroundColor: '#FEF5E7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom : 15
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F39C12',
    letterSpacing: 0.5,
  },

  // Quick Actions Grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  actionButton: {
    width: (width - 48) / 2,
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

  // Communication Grid
  communicationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  communicationCard: {
    width: (width - 48) / 3,
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

  // Record Card Styles
  recordCard: {
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
  recordIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordContent: {
    flex: 1,
    marginLeft: 12,
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 2,
  },
  recordSubtitle: {
    fontSize: 12,
    color: '#7F8C8D',
  },

  // Teacher Card Styles
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
  subjectTag: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectTagText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Search Bar Styles
  searchContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2C3E50',
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  searchResultText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 8,
    marginLeft: 4,
  },

  // Student List Styles
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

  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#7F8C8D',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#BDC3C7',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default TeacherAdminClassDetailsScreen ;