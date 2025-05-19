import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Image,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  FlatList
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

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherHome'>;

// Define types
interface Teacher {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  profileImage?: string;
}

interface Class {
  _id: string;
  name: string;
  grade: string;
  section: string;
  studentsCount: number;
  schedule?: string;
  room?: string;
}

const TeacherHomeScreen: React.FC<Props> = ({ navigation }) => {
  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // States
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [statsData, setStatsData] = useState({
    totalStudents: 0,
    totalClasses: 0,
  });

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Check authentication and load data on app start
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('teacherToken');
        console.log('Retrieved token from storage:', storedToken ? 'Token exists' : 'No token found');
        
        if (!storedToken) {
          console.log('No token in storage, redirecting to login');
          // Navigate to the login screen and prevent going back
          navigation.reset({
            index: 0,
            routes: [{ name: 'TeacherLogin' }],
          });
          return;
        }
        
        // Set token in state for future use
        setToken(storedToken);
        
        // Load data
        await loadTeacherData();
        await fetchClasses(storedToken);
      } catch (error) {
        console.error('Auth check error:', error);
        handleLogout();
      } finally {
        setLoading(false);
      }
    };
    
    checkAuthAndLoadData();
  }, []);

  // Get authenticated API client
  const getAuthenticatedClient = async (authToken = token) => {
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

  // Load teacher data from AsyncStorage or API
  const loadTeacherData = async () => {
    try {
      // Try to get from AsyncStorage first
      const teacherData = await AsyncStorage.getItem('teacherData');
      if (teacherData) {
        setTeacher(JSON.parse(teacherData));
      }
      
      // If not connected or no token, don't try to fetch from API
      if (!isConnected || !token) return;
      
      // Otherwise fetch from API
      await fetchTeacherProfile();
    } catch (error) {
      console.error('Error loading teacher data:', error);
      if (!refreshing) {
        Alert.alert('Error', 'Failed to load profile information');
      }
    }
  };

  // Fetch teacher profile from API
  const fetchTeacherProfile = async () => {
    if (!token) return;
    
    try {
      const apiClient = await getAuthenticatedClient();
      const response = await apiClient.get('/teacher/profile');

      const teacherData = response.data.teacher;
      setTeacher(teacherData);
      await AsyncStorage.setItem('teacherData', JSON.stringify(teacherData));
    } catch (error) {
      console.error('Error fetching teacher profile:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  // Fetch classes assigned to the teacher
  const fetchClasses = async (authToken = token) => {
    setLoading(true);
    try {
      if (!authToken) {
        console.log('No token available for fetching classes');
        navigation.reset({
          index: 0,
          routes: [{ name: 'TeacherLogin' }],
        });
        return;
      }

      // Log only a portion of the token for security
      console.log('Fetching classes with token:', authToken.substring(0, 10) + '...');
      
      // Use apiClient with appropriate headers
      const apiClient = await getAuthenticatedClient(authToken);
      const response = await apiClient.get('/teacher/classes');

      console.log('Classes fetched successfully:', response.data.classes.length);
      const fetchedClasses = response.data.classes;
      setClasses(fetchedClasses);
      
      // Update stats data
      let totalStudents = 0;
      fetchedClasses.forEach((cls: Class) => {
        totalStudents += cls.studentsCount || 0;
      });
      
      setStatsData({
        totalStudents,
        totalClasses: fetchedClasses.length,
      });
    } catch (error) {
      console.error('Error fetching classes:', error);
      
      // Log more details about the error
      if (axios.isAxiosError(error)) {
        console.log('Error status:', error.response?.status);
        console.log('Error data:', error.response?.data);
        
        if (error.response?.status === 401) {
          console.log('Unauthorized access, logging out');
          handleLogout();
        } else if (!refreshing) {
          Alert.alert('Error', `Failed to load classes: ${error.response?.data?.message || 'Please try again'}`);
        }
      } else if (!refreshing) {
        Alert.alert('Error', 'Failed to load classes due to network issue. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    
    // Verify token first, then refresh data
    AsyncStorage.getItem('teacherToken')
      .then(refreshToken => {
        if (refreshToken) {
          console.log('Refreshing with token:', refreshToken.substring(0, 10) + '...');
          setToken(refreshToken); // Update token state
          fetchTeacherProfile();
          fetchClasses(refreshToken);
        } else {
          console.log('No token found during refresh');
          handleLogout();
        }
      })
      .catch(error => {
        console.error('Error during refresh:', error);
        setRefreshing(false);
      });
  };

  // Handle logout
  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Yes", 
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['teacherToken', 'teacherData', 'userRole']);
              setToken(null);
              setTeacher(null);
              setClasses([]);
              
              // Navigate to login and prevent going back
              navigation.reset({
                index: 0,
                routes: [{ name: 'TeacherLogin' }],
              });
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          }
        }
      ]
    );
  };

  // Navigate to class details
  const handleClassPress = (classItem: Class) => {
    navigation.navigate('ClassDetails', { classId: classItem._id, className: classItem.name });
  };

  // Navigate to other screens
  const navigateToSettings = () => {
    Alert.alert("Coming Soon", "Settings screen is under development.");
    // navigation.navigate('TeacherSettings');
  };

  const navigateToNotifications = () => {
    Alert.alert("Coming Soon", "Notifications screen is under development.");
    // navigation.navigate('TeacherNotifications');
  };

  // Render class card
  const renderClassCard = ({ item }: { item: Class }) => (
    <TouchableOpacity 
      style={styles.classCard}
      onPress={() => handleClassPress(item)}
    >
      <LinearGradient
        colors={['#1CB5E0', '#38EF7D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.classGradientBorder}
      >
        <View style={styles.classCardContent}>
          <View style={styles.classIconContainer}>
            <FontAwesome5 name="chalkboard-teacher" size={24} color="#3A4276" />
          </View>
          <View style={styles.classDetails}>
            <Text style={styles.className}>{item.name}</Text>
            <Text style={styles.classInfo}>Grade {item.grade} | Section {item.section}</Text>
            <View style={styles.studentCountContainer}>
              <FontAwesome5 name="user-graduate" size={12} color="#8A94A6" />
              <Text style={styles.studentCount}>{item.studentsCount} Students</Text>
            </View>
          </View>
          <View style={styles.arrowContainer}>
            <MaterialIcons name="arrow-forward-ios" size={16} color="#8A94A6" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  // Show loading indicator
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar hidden={true} />
        <ActivityIndicator size="large" color="#1CB5E0" />
        <Text style={styles.loadingText}>Loading data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={true} />
      
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1CB5E0', '#38EF7D']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.titleContainer}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.teacherName}>{teacher?.name || 'Teacher'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Feather name="log-out" size={20} color="#3A4276" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Teacher Profile Card */}
        <View style={styles.profileContainer}>
          <LinearGradient
            colors={['#1CB5E0', '#38EF7D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.profileGradient}
          >
            <View style={styles.profileContent}>
              <View style={styles.profileImageContainer}>
                {teacher?.profileImage ? (
                  <Image 
                    source={{ uri: teacher.profileImage }} 
                    style={styles.profileImage} 
                  />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Text style={styles.profileInitials}>
                      {teacher?.name ? teacher.name.charAt(0).toUpperCase() : 'T'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.profileDetails}>
                <Text style={styles.profileEmail}>{teacher?.email || 'Loading...'}</Text>
                <Text style={styles.profileRole}>Teacher</Text>
                {teacher?.subject && (
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>{teacher.subject}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => Alert.alert("Coming Soon", "Edit profile feature is under development.")}
              >
                <Feather name="edit-2" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Quick Statistics</Text>
          
          <View style={styles.statsCardsContainer}>
            <View style={styles.statsCard}>
              <View style={[styles.statsIconContainer, { backgroundColor: 'rgba(28, 181, 224, 0.1)' }]}>
                <FontAwesome5 name="chalkboard-teacher" size={22} color="#1CB5E0" />
              </View>
              <Text style={styles.statsNumber}>{statsData.totalClasses}</Text>
              <Text style={styles.statsLabel}>Classes</Text>
            </View>
            
            <View style={styles.statsCard}>
              <View style={[styles.statsIconContainer, { backgroundColor: 'rgba(56, 239, 125, 0.1)' }]}>
                <FontAwesome5 name="user-graduate" size={22} color="#38EF7D" />
              </View>
              <Text style={styles.statsNumber}>{statsData.totalStudents}</Text>
              <Text style={styles.statsLabel}>Students</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.statsCard}
              onPress={navigateToSettings}
            >
              <View style={[styles.statsIconContainer, { backgroundColor: 'rgba(58, 66, 118, 0.1)' }]}>
                <Feather name="settings" size={22} color="#3A4276" />
              </View>
              <Text style={styles.statsNumber}>
                <Feather name="chevron-right" size={18} color="#3A4276" />
              </Text>
              <Text style={styles.statsLabel}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Classes Section */}
        <View style={styles.classesSection}>
          <Text style={styles.sectionTitle}>My Classes</Text>
          
          {classes.length === 0 ? (
            <View style={styles.noClassesContainer}>
              <FontAwesome5 name="book" size={48} color="#B0B7C3" />
              <Text style={styles.noClassesText}>No classes assigned yet</Text>
              <Text style={styles.noClassesSubtext}>
                Pull down to refresh or contact administration
              </Text>
            </View>
          ) : (
            <FlatList
              data={classes}
              renderItem={renderClassCard}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              contentContainerStyle={styles.classesList}
            />
          )}
        </View>

        {/* Notifications Card */}
        <TouchableOpacity 
          style={styles.notificationsCard}
          onPress={navigateToNotifications}
        >
          <LinearGradient
            colors={['#1CB5E0', '#38EF7D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.notificationsGradient}
          >
            <View style={styles.notificationsContent}>
              <View style={styles.notificationsIconContainer}>
                <MaterialIcons name="notifications" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.notificationsTextContainer}>
                <Text style={styles.notificationsTitle}>Check Notifications</Text>
                <Text style={styles.notificationsSubtitle}>Stay updated with class activities</Text>
              </View>
              <Feather name="chevron-right" size={24} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Vidyarthi Teacher v1.0.0</Text>
        </View>
      </ScrollView>
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    marginTop: 16,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: '#8A94A6',
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A4276',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 30,
    height: 30,
    marginRight: 8,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
  },
  profileContainer: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1CB5E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  profileGradient: {
    padding: 2,
    borderRadius: 16,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  profileImageContainer: {
    marginRight: 16,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1CB5E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  profileEmail: {
    fontSize: 16,
    color: '#3A4276',
    fontWeight: '500',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: '#1CB5E0',
    marginBottom: 8,
  },
  subjectBadge: {
    backgroundColor: 'rgba(28, 181, 224, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  subjectText: {
    fontSize: 12,
    color: '#1CB5E0',
    fontWeight: '600',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#38EF7D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 16,
  },
  statsCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '31%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statsIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A4276',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 12,
    color: '#8A94A6',
  },
  classesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 16,
  },
  classesList: {
    paddingBottom: 16,
  },
  classCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  classGradientBorder: {
    padding: 2,
    borderRadius: 16,
  },
  classCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  classIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(28, 181, 224, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  classDetails: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3A4276',
    marginBottom: 4,
  },
  classInfo: {
    fontSize: 14,
    color: '#8A94A6',
    marginBottom: 8,
  },
  studentCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentCount: {
    fontSize: 12,
    color: '#8A94A6',
    marginLeft: 6,
  },
  arrowContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noClassesContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  noClassesText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
  },
  noClassesSubtext: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
  },
  notificationsCard: {
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  notificationsGradient: {
    borderRadius: 12,
  },
  notificationsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  notificationsIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notificationsTextContainer: {
    flex: 1,
  },
  notificationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  notificationsSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#8A94A6',
  },
});

export default TeacherHomeScreen;