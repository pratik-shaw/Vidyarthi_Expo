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
  Image,
  ScrollView,
  TextStyle,
  ViewStyle
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState } from 'react';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// API base URL - replace with your actual backend URL
const API_URL = 'http://192.168.29.148:5000/api';
const API_TIMEOUT = 15000; // 15 seconds timeout

// Properly define the route params type
type TeacherClassDetailsParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherClassDetails'>;

// Define types
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
  attendance?: {
    present: number;
    absent: number;
    percentage: number;
  };
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

const TeacherClassDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  // Get classId from route params with proper type assertion
  const { classId, className } = route.params as unknown as TeacherClassDetailsParams;
  
  // States
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Set header title
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: className || 'Class Details',
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#3A4276',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
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
      const response = await apiClient.get(`/class/${classId}`);
      
      setClassDetails(response.data);
      console.log('Class details fetched:', response.data);
    } catch (error) {
      console.error('Error fetching class details:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
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
  // Note: In a real app, this would come from the API
  // Generate random attendance data
// Note: In a real app, this would come from the API
const generateAttendanceData = (studentId: string) => {
  // Check if studentId exists and use a default if it doesn't
  const idToUse = studentId || `default-${Math.random()}`;
  
  // Use studentId as seed for consistent but random-looking values
  const seed = idToUse.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const present = 10 + (seed % 15); // Between 10-24 days present
  const absent = Math.max(1, 3 + (seed % 5)); // Between 3-7 days absent
  const total = present + absent;
  const percentage = Math.round((present / total) * 100);
  
  return {
    present,
    absent,
    percentage
  };
};

  // Render student item
  const renderStudentItem = ({ item, index }: { item: Student; index: number }) => {
    // Generate attendance data for this student
    const attendance = item.attendance || generateAttendanceData(item._id);
    
    return (
      <View style={[
        styles.studentRow, 
        index % 2 === 0 ? styles.evenRow : styles.oddRow
      ]}>
        <Text style={[styles.studentCell, styles.idCell]}>{item.studentId || `ST${index + 1001}`}</Text>
        <Text style={[styles.studentCell, styles.nameCell]}>{item.name}</Text>
        <View style={[styles.studentCellContainer, styles.attendanceCell]}>
          <View style={styles.attendanceBar}>
            <View 
              style={[
                styles.attendanceProgress, 
                { 
                  width: `${attendance.percentage}%`,
                  backgroundColor: attendance.percentage >= 75 ? '#38EF7D' : 
                                  attendance.percentage >= 60 ? '#FFB946' : '#F7685B'
                }
              ]} 
            />
          </View>
          <Text style={styles.attendanceText}>{attendance.percentage}%</Text>
        </View>
        <View style={[styles.studentCellContainer, styles.actionsCell]}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert("Coming Soon", "Student detail view is under development.")}
          >
            <FontAwesome5 name="info-circle" size={16} color="#1CB5E0" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Show loading indicator
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar hidden={true} />
        <ActivityIndicator size="large" color="#1CB5E0" />
        <Text style={styles.loadingText}>Loading class details...</Text>
      </SafeAreaView>
    );
  }

  // Show error message
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar hidden={true} />
        <FontAwesome5 name="exclamation-circle" size={48} color="#F7685B" />
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
            colors={['#1CB5E0', '#38EF7D']}
          />
        }
      >
        {/* Class Details Card */}
        <View style={styles.classCardContainer}>
          <LinearGradient
            colors={['#1CB5E0', '#38EF7D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.classGradient}
          >
            <View style={styles.classCardContent}>
              <View style={styles.classIconContainer}>
                <FontAwesome5 name="chalkboard-teacher" size={32} color="#3A4276" />
              </View>
              
              <View style={styles.classDetails}>
                <Text style={styles.className}>{classDetails?.name || 'Class Name'}</Text>
                <Text style={styles.classSection}>Section: {classDetails?.section || '-'}</Text>
                <Text style={styles.studentCount}>
                  <FontAwesome5 name="user-graduate" size={14} color="#3A4276" />
                  {' '}{classDetails?.studentIds?.length || 0} Students
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Teachers Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Teachers</Text>
          
          {classDetails?.teacherIds && classDetails.teacherIds.length > 0 ? (
            <View style={styles.teachersContainer}>
              {classDetails.teacherIds.map((teacher, index) => (
                <View key={teacher._id || index} style={styles.teacherCard}>
                  <View style={styles.teacherIconContainer}>
                    <FontAwesome5 name="user-tie" size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.teacherDetails}>
                    <Text style={styles.teacherName}>{teacher.name}</Text>
                    <Text style={styles.teacherEmail}>{teacher.email}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>No teachers assigned to this class</Text>
            </View>
          )}
        </View>

        {/* Students Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Students</Text>
          
          {classDetails?.studentIds && classDetails.studentIds.length > 0 ? (
            <View style={styles.studentsTableContainer}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.idCell]}>ID</Text>
                <Text style={[styles.headerCell, styles.nameCell]}>Name</Text>
                <Text style={[styles.headerCell, styles.attendanceCell]}>Attendance</Text>
                <Text style={[styles.headerCell, styles.actionsCell]}>Action</Text>
              </View>
              
              {/* Student List */}
              <FlatList
                data={classDetails.studentIds}
                renderItem={renderStudentItem}
                keyExtractor={(item) => item._id || item.studentId || `student-${Math.random()}`}
                scrollEnabled={false}
                contentContainerStyle={styles.studentsList}
              />
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <FontAwesome5 name="user-graduate" size={36} color="#B0B7C3" />
              <Text style={styles.emptyStateText}>No students in this class</Text>
              <Text style={styles.emptyStateSubtext}>
                Students need to be enrolled in the class
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: 'rgba(28, 181, 224, 0.1)' }]}
            onPress={() => Alert.alert("Coming Soon", "Attendance tracking feature is under development.")}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#1CB5E0' }]}>
              <FontAwesome5 name="calendar-check" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Take Attendance</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: 'rgba(58, 66, 118, 0.1)' }]}
            onPress={() => Alert.alert("Coming Soon", "Class materials feature is under development.")}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#3A4276' }]}>
              <FontAwesome5 name="book" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Class Materials</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionCard, { backgroundColor: 'rgba(56, 239, 125, 0.1)' }]}
            onPress={() => Alert.alert("Coming Soon", "Performance reports feature is under development.")}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#38EF7D' }]}>
              <FontAwesome5 name="chart-bar" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Reports</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Add type assertions for styles
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1CB5E0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  classCardContainer: {
    marginVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1CB5E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  classGradient: {
    padding: 2,
    borderRadius: 16,
  },
  classCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  classIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(28, 181, 224, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  classDetails: {
    flex: 1,
  },
  className: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A4276',
    marginBottom: 4,
  },
  classSection: {
    fontSize: 16,
    color: '#8A94A6',
    marginBottom: 8,
  },
  studentCount: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '500',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 12,
  },
  teachersContainer: {
    marginHorizontal: -6,
  },
  teacherCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    minWidth: '45%',
    flexGrow: 1,
  },
  teacherIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3A4276',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teacherDetails: {
    flex: 1,
  },
  teacherName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 2,
  },
  teacherEmail: {
    fontSize: 12,
    color: '#8A94A6',
  },
  emptyStateContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
  },
  studentsTableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F0F2F8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerCell: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
  } as TextStyle,
  idCell: {
    width: '20%',
  } as TextStyle,
  nameCell: {
    width: '30%', 
    flex: 1,
  } as TextStyle,
  attendanceCell: {
    width: '30%',
  } as TextStyle | ViewStyle,
  actionsCell: {
    width: '15%',
    alignItems: 'center',
  } as TextStyle | ViewStyle,
  studentsList: {
    flexGrow: 1,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF2F7',
  },
  evenRow: {
    backgroundColor: '#FFFFFF',
  },
  oddRow: {
    backgroundColor: '#F8F9FC',
  },
  studentCell: {
    fontSize: 14,
    color: '#3A4276',
  } as TextStyle,
  studentCellContainer: {
  padding: 10,
  backgroundColor: '#F8F9FC',
  borderRadius: 8,
  // Other ViewStyle properties
} as ViewStyle,
  attendanceBar: {
    width: '80%',
    height: 6,
    backgroundColor: '#EFF2F7',
    borderRadius: 3,
    marginBottom: 4,
  },
  attendanceProgress: {
    height: '100%',
    borderRadius: 3,
  },
  attendanceText: {
    fontSize: 12,
    color: '#8A94A6',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(28, 181, 224, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionCard: {
    width: '31%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3A4276',
    textAlign: 'center',
  },
});

export default TeacherClassDetailsScreen;