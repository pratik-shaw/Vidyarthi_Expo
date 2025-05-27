import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';

// API URL with configurable timeout
const API_URL = 'http://192.168.29.148:5000/api'; // Change this to your server IP/domain
const API_TIMEOUT = 15000; // 15 seconds timeout

type Props = NativeStackScreenProps<RootStackParamList, 'AdminHome'>;

interface AdminData {
  _id: string;
  name: string;
  email: string;
  schoolCode: string;
  schoolId: string;
  createdAt: string;
}

interface SchoolData {
  _id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  website?: string;
  createdAt: string;
}

interface StatsData {
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
}

const AdminHomeScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [statsData, setStatsData] = useState<StatsData>({
    totalTeachers: 0,
    totalStudents: 0,
    totalClasses: 0
  });

  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Load data on initial render
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          // Not authenticated, redirect to role selection
          navigation.replace('RoleSelection');
          return;
        }

        // Load data from API
        await loadAdminData();
      } catch (error) {
        console.error('Auth check error:', error);
        handleLogout();
      }
    };

    checkAuthAndLoadData();
  }, [navigation]);

  // Create axios instance with auth token
  const getAuthenticatedClient = async () => {
    const token = await AsyncStorage.getItem('token');
    return axios.create({
      baseURL: API_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  };

  // Load admin data from API
  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      // Check if we have a cached version of the admin data
      const cachedAdminData = await AsyncStorage.getItem('adminData');
      if (cachedAdminData) {
        setAdminData(JSON.parse(cachedAdminData));
      }

      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      const apiClient = await getAuthenticatedClient();
      
      // Load admin profile
      const profileResponse = await apiClient.get('/admin/profile');
      const adminProfile = profileResponse.data;
      setAdminData(adminProfile);
      await AsyncStorage.setItem('adminData', JSON.stringify(adminProfile));

      // Load school data
      const schoolResponse = await apiClient.get('/admin/school');
      const schoolData = schoolResponse.data;
      setSchoolData(schoolData);
      
      // Load stats data
      const [teachersResponse, studentsResponse, classesResponse] = await Promise.all([
        apiClient.get('/admin/teachers'),
        apiClient.get('/admin/students'),
        apiClient.get('/admin/classes')
      ]);
      
      setStatsData({
        totalTeachers: teachersResponse.data.length,
        totalStudents: studentsResponse.data.length,
        totalClasses: classesResponse.data.length
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Unauthorized, token might be expired
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please login again.",
          [{ text: "OK", onPress: () => handleLogout() }]
        );
      } else {
        Alert.alert(
          "Data Loading Error",
          "Failed to load data. Please check your connection and try again."
        );
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
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
              // Clear auth data
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('userRole');
              await AsyncStorage.removeItem('adminData');
              
              // Navigate to role selection
              navigation.replace('RoleSelection');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          }
        }
      ]
    );
  };

  // Navigate to specific screens

  const navigateToTeachersData = () => {
    navigation.navigate('AdminAllTeachersData');
  };
  const navigateToStudentsData = () => {
    navigation.navigate('AdminAllStudentsData');  };

  const navigateToClassesData = () => {
    Alert.alert("Coming Soon", "Teacher management screen is under development.");
  };

  const navigateToTeachers = () => {
    navigation.navigate('AdminAddClassTeacher');
  };

  const navigateToStudents = () => {
    Alert.alert("Coming Soon", "Student management screen is under development.");
    // navigation.navigate('AdminStudents');
  };

  const navigateToClasses = () => {
    navigation.navigate('AdminClasses');
  };

  const navigateToSchoolProfile = () => {
    Alert.alert("Coming Soon", "School profile screen is under development.");
    // navigation.navigate('SchoolProfile');
  };

  const navigateToSettings = () => {
    Alert.alert("Coming Soon", "Settings screen is under development.");
    // navigation.navigate('AdminSettings');
  };

  const navigateToNotifications = () => {
    Alert.alert("Coming Soon", "Notifications screen is under development.");
    // navigation.navigate('AdminNotifications');
  };

  // Show loading indicator
  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        <ActivityIndicator size="large" color="#4E54C8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#4E54C8"]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.titleContainer}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.adminName}>{adminData?.name || 'Administrator'}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Feather name="log-out" size={22} color="#3A4276" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.adminInfoCard}>
            <View style={styles.adminAvatarContainer}>
              <FontAwesome5 name="user-tie" size={34} color="#4E54C8" />
            </View>
            
            <View style={styles.adminDetailsContainer}>
              <Text style={styles.adminEmail}>{adminData?.email || 'admin@school.com'}</Text>
              <Text style={styles.adminRole}>School Administrator</Text>
              <Text style={styles.adminCode}>School Code: {adminData?.schoolCode || 'N/A'}</Text>
            </View>
          </View>
        </View>
        
        {/* School Information */}
        <TouchableOpacity 
          style={styles.schoolInfoCard}
          onPress={navigateToSchoolProfile}
        >
          <View style={styles.schoolHeaderContainer}>
            <Text style={styles.schoolInfoTitle}>School Information</Text>
            <Feather name="chevron-right" size={20} color="#8A94A6" />
          </View>
          
          <View style={styles.schoolDetailsRow}>
            <View style={styles.schoolIconContainer}>
              <FontAwesome5 name="school" size={24} color="#4E54C8" />
            </View>
            <View style={styles.schoolDetails}>
              <Text style={styles.schoolName}>{schoolData?.name || 'School Name'}</Text>
              <Text style={styles.schoolAddress}>
                {schoolData?.address 
                  ? `${schoolData.address}, ${schoolData.city || ''}, ${schoolData.state || ''}`
                  : 'Address not available'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Statistics */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Quick Statistics</Text>
          
          <View style={styles.statsCardsContainer}>
            <TouchableOpacity 
              style={styles.statsCard}
              onPress={navigateToTeachersData}
            >
              <View style={[styles.statsIconContainer, { backgroundColor: 'rgba(78, 84, 200, 0.1)' }]}>
                <FontAwesome5 name="chalkboard-teacher" size={22} color="#4E54C8" />
              </View>
              <Text style={styles.statsNumber}>{statsData.totalTeachers}</Text>
              <Text style={styles.statsLabel}>Teachers</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.statsCard}
              onPress={navigateToStudentsData}
            >
              <View style={[styles.statsIconContainer, { backgroundColor: 'rgba(46, 213, 115, 0.1)' }]}>
                <FontAwesome5 name="user-graduate" size={22} color="#2ED573" />
              </View>
              <Text style={styles.statsNumber}>{statsData.totalStudents}</Text>
              <Text style={styles.statsLabel}>Students</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.statsCard}
              onPress={navigateToClassesData}
            >
              <View style={[styles.statsIconContainer, { backgroundColor: 'rgba(255, 165, 2, 0.1)' }]}>
                <Ionicons name="book" size={22} color="#FFA502" />
              </View>
              <Text style={styles.statsNumber}>{statsData.totalClasses}</Text>
              <Text style={styles.statsLabel}>Classes</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={navigateToTeachers}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#4E54C8' }]}>
                <FontAwesome5 name="user-plus" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Assign Class Teacher</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard} onPress={navigateToStudents}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#2ED573' }]}>
                <FontAwesome5 name="user-plus" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Add Student</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard} onPress={navigateToClasses}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#FFA502' }]}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Create Class</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard} onPress={navigateToSettings}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#8A94A6' }]}>
                <Feather name="settings" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Notifications Card */}
        <TouchableOpacity 
          style={styles.notificationsCard}
          onPress={navigateToNotifications}
        >
          <LinearGradient
            colors={['#4E54C8', '#8F94FB']}
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
                <Text style={styles.notificationsSubtitle}>Stay updated with school activities</Text>
              </View>
              <Feather name="chevron-right" size={24} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
        
        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>School Admin v1.0.0</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#3A4276',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  header: {
    marginTop: 16,
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: '#8A94A6',
    marginBottom: 4,
  },
  adminName: {
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
  adminInfoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  adminAvatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  adminDetailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  adminEmail: {
    fontSize: 16,
    color: '#3A4276',
    fontWeight: '500',
    marginBottom: 4,
  },
  adminRole: {
    fontSize: 14,
    color: '#4E54C8',
    marginBottom: 4,
  },
  adminCode: {
    fontSize: 12,
    color: '#8A94A6',
  },
  schoolInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  schoolHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  schoolInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
  },
  schoolDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schoolIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  schoolDetails: {
    flex: 1,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A4276',
    marginBottom: 4,
  },
  schoolAddress: {
    fontSize: 13,
    color: '#8A94A6',
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
  quickActionsContainer: {
    marginBottom: 20,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '500',
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
  }
});

export default AdminHomeScreen;