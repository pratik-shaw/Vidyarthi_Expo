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
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState } from 'react';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { API_BASE_URL} from '../config/api';

// API URL with configurable timeout
const API_URL = API_BASE_URL; // Change this to your server IP/domain
const API_TIMEOUT = 15000; // 15 seconds timeout


// Properly define the route params type
type TeacherAdminClassDetailsParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAdminClassDetails'>;

// Define types
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

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  backgroundColor: string;
}

const TeacherAdminClassDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  // Get classId from route params with proper type assertion
  const { classId, className } = route.params as unknown as TeacherAdminClassDetailsParams;
  
  // States
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'teachers' | 'more'>('overview');
  
  // Set header title with admin badge
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `${className || 'Admin Class'}`,
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2D3748',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
      headerRight: () => (
        <View style={styles.headerBadge}>
          <FontAwesome5 name="crown" size={12} color="#4299E1" />
          <Text style={styles.headerBadgeText}>ADMIN</Text>
        </View>
      ),
    });
  }, [navigation, className]);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Load data on component mount
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

  // Get authenticated API client
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

  // Fetch class details from API
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
      
      // Transform data to match frontend expectations
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
      console.log('Admin class details fetched:', transformedData);
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

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchClassDetails();
  };

  // Handle session expired
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

  // Generate random attendance data
  const generateAttendanceData = (studentId: string) => {
    const idToUse = studentId || `default-${Math.random()}`;
    const seed = idToUse.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const present = 15 + (seed % 10); // Between 15-24 days present
    const absent = Math.max(1, 2 + (seed % 4)); // Between 2-5 days absent
    const total = present + absent;
    const percentage = Math.round((present / total) * 100);
    
    return {
      present,
      absent,
      percentage
    };
  };

  // Quick actions configuration for overview
  const getQuickActions = (): QuickAction[] => [
  {
    id: 'take_attendance',
    title: 'Take Attendance',
    description: 'Mark daily attendance',
    icon: 'clipboard-check',
    color: '#4299E1',
    backgroundColor: 'rgba(66, 153, 225, 0.1)'
  },
  {
    id: 'view_reports',
    title: 'View Reports',
    description: 'Student performance',
    icon: 'chart-bar',
    color: '#48BB78',
    backgroundColor: 'rgba(72, 187, 120, 0.1)'
  },
  {
    id: 'announcements',
    title: 'Announcements',
    description: 'Class notifications',
    icon: 'bullhorn',
    color: '#ED8936',
    backgroundColor: 'rgba(237, 137, 54, 0.1)'
  },
  {
    id: 'chat_room',
    title: 'Chat Room',
    description: 'Class discussions',
    icon: 'comments',
    color: '#9F7AEA',
    backgroundColor: 'rgba(159, 122, 234, 0.1)'
  },
  {
    id: 'add_materials',
    title: 'Add Materials',
    description: 'Upload resources & files',
    icon: 'folder-plus',
    color: '#38B2AC',
    backgroundColor: 'rgba(56, 178, 172, 0.1)'
  },
  {
    id: 'schedule_events_dates',
    title: 'Schedule Events & Dates',
    description: 'Manage calendar & deadlines',
    icon: 'calendar-alt',
    color: '#E53E3E',
    backgroundColor: 'rgba(229, 62, 62, 0.1)'
  }
];

  // Handle quick action press
  const handleQuickAction = (actionId: string) => {
  switch (actionId) {
    case 'take_attendance':
navigation.navigate('TeacherAdminTakeAttendance', {
      classId: classId,
      className: className,
    });      break;
    case 'view_reports':
  // If showing reports for all students in class
  navigation.navigate('TeacherAdminStudentReport', {
    classId: classDetails?._id || classId,
    className: classDetails?.name || className,
    studentId: '', // or undefined if made optional
    studentName: '' // or undefined if made optional
  });
  break;
    case 'announcements':
      Alert.alert("Coming Soon", "Announcements feature is under development.");
      break;
    case 'chat_room':
      Alert.alert("Coming Soon", "Chat room feature is under development.");
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
    default:
      Alert.alert("Coming Soon", "This feature is under development.");
  }
};

  // Render tab navigation
  const renderTabNavigation = () => (
    <View style={styles.tabContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
        {[
          { key: 'overview', title: 'Overview', icon: 'home' },
          { key: 'students', title: 'Students', icon: 'user-graduate' },
          { key: 'teachers', title: 'Teachers', icon: 'chalkboard-teacher' },
          { key: 'more', title: 'More Options', icon: 'ellipsis-h' }
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              activeTab === tab.key && styles.activeTabButton
            ]}
            onPress={() => setActiveTab(tab.key as typeof activeTab)}
          >
            <FontAwesome5 
              name={tab.icon} 
              size={16} 
              color={activeTab === tab.key ? '#FFFFFF' : '#718096'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.key && styles.activeTabText
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Render overview tab
  const renderOverviewTab = () => (
    <View>
      {/* Quick Actions */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.actionsGrid}>
          {getQuickActions().map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.actionCard, { backgroundColor: action.backgroundColor }]}
              onPress={() => handleQuickAction(action.id)}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: action.color }]}>
                <FontAwesome5 name={action.icon} size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Class Overview Stats */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Class Overview</Text>
        
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { borderLeftColor: '#4299E1' }]}>
            <View style={styles.statHeader}>
              <FontAwesome5 name="user-graduate" size={20} color="#4299E1" />
              <Text style={styles.statNumber}>{classDetails?.studentIds?.length || 0}</Text>
            </View>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>
          
          <View style={[styles.statCard, { borderLeftColor: '#48BB78' }]}>
            <View style={styles.statHeader}>
              <FontAwesome5 name="chalkboard-teacher" size={20} color="#48BB78" />
              <Text style={styles.statNumber}>{classDetails?.teacherIds?.length || 0}</Text>
            </View>
            <Text style={styles.statLabel}>Teachers</Text>
          </View>
          
          <View style={[styles.statCard, { borderLeftColor: '#ED8936' }]}>
            <View style={styles.statHeader}>
              <FontAwesome5 name="percentage" size={20} color="#ED8936" />
              <Text style={styles.statNumber}>87%</Text>
            </View>
            <Text style={styles.statLabel}>Avg Attendance</Text>
          </View>
        </View>
      </View>

      {/* Class Information */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Class Information</Text>
        
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <FontAwesome5 name="door-open" size={16} color="#718096" />
            <Text style={styles.infoLabel}>Room:</Text>
            <Text style={styles.infoValue}>{classDetails?.room || 'Not assigned'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <FontAwesome5 name="clock" size={16} color="#718096" />
            <Text style={styles.infoLabel}>Schedule:</Text>
            <Text style={styles.infoValue}>{classDetails?.schedule || 'Not set'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <FontAwesome5 name="info-circle" size={16} color="#718096" />
            <Text style={styles.infoLabel}>Description:</Text>
            <Text style={styles.infoValue}>{classDetails?.description || 'No description'}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Render students tab
const renderStudentsTab = () => (
  <View style={styles.sectionContainer}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Students ({classDetails?.studentIds?.length || 0})</Text>
    </View>
    
    {classDetails?.studentIds && classDetails.studentIds.length > 0 ? (
      <View style={styles.studentsContainer}>
        {classDetails.studentIds.map((student, index) => (
          <TouchableOpacity
            key={student._id || index}
            style={styles.studentCard}
            onPress={() => {
              navigation.navigate('TeacherStudentDetailsScreen', {
                studentId: student._id,
                studentName: student.name,
                classId: classDetails._id || classId,
                className: classDetails.name || className,
              });
            }}
            activeOpacity={0.7}
          >
            <View style={styles.studentInfo}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentInitial}>
                  {student.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              
              <View style={styles.studentDetails}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentId}>ID: {student.studentId || `ST${index + 1001}`}</Text>
                {student.email && (
                  <Text style={styles.studentEmail}>{student.email}</Text>
                )}
              </View>
            </View>
            
            <View style={styles.studentActions}>
              <FontAwesome5 name="chevron-right" size={16} color="#A0AEC0" />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    ) : (
      <View style={styles.emptyStateContainer}>
        <FontAwesome5 name="user-graduate" size={48} color="#CBD5E0" />
        <Text style={styles.emptyStateText}>No students enrolled</Text>
        <Text style={styles.emptyStateSubtext}>Students will appear here once enrolled</Text>
      </View>
    )}
  </View>
);

  // Render teachers tab
  const renderTeachersTab = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Teachers ({classDetails?.teacherIds?.length || 0})</Text>
      </View>
      
      {classDetails?.teacherIds && classDetails.teacherIds.length > 0 ? (
        <View style={styles.teachersContainer}>
          {classDetails.teacherIds.map((teacher, index) => (
            <View key={teacher._id || index} style={styles.teacherCard}>
              <View style={styles.teacherIconContainer}>
                <FontAwesome5 name="chalkboard-teacher" size={24} color="#FFFFFF" />
              </View>
              
              <View style={styles.teacherDetails}>
                <Text style={styles.teacherName}>{teacher.name}</Text>
                <Text style={styles.teacherEmail}>{teacher.email}</Text>
                {teacher.subject && (
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>{teacher.subject}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyStateContainer}>
          <FontAwesome5 name="chalkboard-teacher" size={48} color="#CBD5E0" />
          <Text style={styles.emptyStateText}>No teachers assigned</Text>
          <Text style={styles.emptyStateSubtext}>Teachers will appear here once assigned</Text>
        </View>
      )}
    </View>
  );

  // Render more options tab
  // Updated renderMoreOptionsTab function for TeacherAdminClassDetailsScreen.tsx

const renderMoreOptionsTab = () => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionTitle}>More Options</Text>
    
    <View style={styles.optionsContainer}>
      <TouchableOpacity 
        style={styles.optionItem}
        onPress={() => {
          // Navigate to TeacherAdminStudentAcademicSheet
          navigation.navigate('TeacherAttendanceSheet', {
            classId: classDetails?._id || classId,
            className: classDetails?.name || className,
          });
        }}      >
        <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(66, 153, 225, 0.1)' }]}>
          <FontAwesome5 name="clipboard-list" size={20} color="#4299E1" />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Attendance Sheet</Text>
          <Text style={styles.optionDescription}>View and manage attendance records</Text>
        </View>
        <FontAwesome5 name="chevron-right" size={16} color="#A0AEC0" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.optionItem}
        onPress={() => {
          // Navigate to Student Report Cards
          navigation.navigate('TeacherAdminStudentReportCard', {
            classId: classDetails?._id || classId,
            className: classDetails?.name || className,
            studentId: '', // Empty for class-wide report cards
            studentName: '' // Empty for class-wide report cards
          });
        }}
      >
        <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(72, 187, 120, 0.1)' }]}>
          <FontAwesome5 name="file-alt" size={20} color="#48BB78" />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Students Report Card</Text>
          <Text style={styles.optionDescription}>Generate and view report cards</Text>
        </View>
        <FontAwesome5 name="chevron-right" size={16} color="#A0AEC0" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.optionItem}
        onPress={() => {
          // Navigate to TeacherAdminStudentAcademicSheet
          navigation.navigate('TeacherAdminStudentAcademicSheet', {
            classId: classDetails?._id || classId,
            className: classDetails?.name || className,
            studentId: '', // Empty for class-wide academic records
            studentName: '' // Empty for class-wide academic records
          });
        }}
      >
        <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(237, 137, 54, 0.1)' }]}>
          <FontAwesome5 name="graduation-cap" size={20} color="#ED8936" />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Students Academic Records</Text>
          <Text style={styles.optionDescription}>Subject-wise academic performance</Text>
        </View>
        <FontAwesome5 name="chevron-right" size={16} color="#A0AEC0" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.optionItem}
         onPress={() => navigation.navigate('TeacherAdminSubjects',{
          classId: classDetails?._id || classId, // Use actual class ID from details or route params
          className: classDetails?.name || className  // or whatever the class name is
         })}
      >
        <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
          <FontAwesome5 name="book" size={20} color="#EC4899" />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Subjects & Teachers</Text>
          <Text style={styles.optionDescription}>Manage subjects and teacher assignment</Text>
        </View>
        <FontAwesome5 name="chevron-right" size={16} color="#A0AEC0" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.optionItem}
        onPress={() => navigation.navigate('TeacherAdminExams', {
          classId: classId, // Use actual class ID from details or route params
          className: className  // or whatever the class name is
        })}
      >
        <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(245, 101, 101, 0.1)' }]}>
          <FontAwesome5 name="book-open" size={20} color="#F56565" />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Examinations & Assessments</Text>
          <Text style={styles.optionDescription}>Manage examinations and school assessments</Text>
        </View>
        <FontAwesome5 name="chevron-right" size={16} color="#A0AEC0" />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.optionItem}
        onPress={() => navigation.navigate('TeacherScoring', {
          classId: classId, // Use actual class ID from details or route params
          className: className  // or whatever the class name is
        })}
      >
        <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
          <FontAwesome5 name="poll" size={20} color="#6366F1" />
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Add Marks</Text>
          <Text style={styles.optionDescription}>Add marks as a subject teacher to your own class students</Text>
        </View>
        <FontAwesome5 name="chevron-right" size={16} color="#A0AEC0" />
      </TouchableOpacity>
    </View>
  </View>
);

  // Show loading indicator
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar hidden={true} />
        <ActivityIndicator size="large" color="#4299E1" />
        <Text style={styles.loadingText}>Loading admin class details...</Text>
      </SafeAreaView>
    );
  }

  // Show error message
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar hidden={true} />
        <FontAwesome5 name="exclamation-triangle" size={48} color="#F56565" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => fetchClassDetails()}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={true} />
      
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4299E1', '#48BB78']}
          />
        }
      >
        {/* Class Header Card */}
        <View style={styles.classHeaderContainer}>
          <LinearGradient
            colors={['#667EEA', '#764BA2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.classHeaderGradient}
          >
            <View style={styles.classHeaderContent}>
              <View style={styles.classHeaderIcon}>
                <FontAwesome5 name="shield-alt" size={28} color="#FFFFFF" />
              </View>
              
              <View style={styles.classHeaderDetails}>
                <View style={styles.adminBadgeContainer}>
                  <View style={styles.adminBadge}>
                    <FontAwesome5 name="crown" size={10} color="#FFD700" />
                    <Text style={styles.adminBadgeText}>ADMIN CLASS</Text>
                  </View>
                </View>
                
                <Text style={styles.classHeaderName}>{classDetails?.name || className}</Text>
                <Text style={styles.classHeaderInfo}>
                  {classDetails?.section && `Section ${classDetails.section}`}
                  {classDetails?.grade && ` • Grade ${classDetails.grade}`}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Tab Navigation */}
        {renderTabNavigation()}

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'students' && renderStudentsTab()}
          {activeTab === 'teachers' && renderTeachersTab()}
          {activeTab === 'more' && renderMoreOptionsTab()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A5568',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#4299E1',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(66, 153, 225, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4299E1',
    marginLeft: 4,
  },
  classHeaderContainer: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  classHeaderGradient: {
    padding: 24,
  },
  classHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classHeaderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  classHeaderDetails: {
    flex: 1,
    marginLeft: 16,
  },
  adminBadgeContainer: {
    marginBottom: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  classHeaderName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  classHeaderInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tabContainer: {
    marginTop: 20,
    marginBottom: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  activeTabButton: {
    backgroundColor: '#4299E1',
    borderColor: '#4299E1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabContent: {
    paddingHorizontal: 16,
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    borderLeftWidth: 4,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3748',
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },
  infoContainer: {
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    marginLeft: 12,
    minWidth: 80,
  },
  infoValue: {
    fontSize: 14,
    color: '#2D3748',
    marginLeft: 8,
    flex: 1,
  },
  studentsContainer: {
    marginTop: 8,
  },
  studentCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
  flexDirection: 'row', // Add this line
  alignItems: 'center', // Add this line
  justifyContent: 'space-between', // Add this line
},
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4299E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentDetails: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  studentId: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: 12,
    color: '#4299E1',
  },
  attendanceContainer: {
    marginTop: 8,
  },
  attendanceLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 6,
    fontWeight: '500',
  },
  attendanceBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendanceBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  attendanceProgress: {
    height: '100%',
    borderRadius: 4,
  },
  attendancePercentage: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
  },
  teachersContainer: {
    marginTop: 8,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teacherIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#48BB78',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teacherDetails: {
    flex: 1,
    marginLeft: 12,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  teacherEmail: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 4,
  },
  subjectBadge: {
    backgroundColor: '#4299E1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  subjectText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#718096',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#A0AEC0',
    marginTop: 4,
    textAlign: 'center',
  },
  optionsContainer: {
    marginTop: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 12,
    color: '#718096',
    lineHeight: 16,
  },
  studentActions: {
  justifyContent: 'center',
  alignItems: 'center',
  paddingLeft: 12,
},
});

export default TeacherAdminClassDetailsScreen;