// StudentHomeScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import { 
  ScrollView, 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Image, 
  Dimensions,
  StatusBar,
  Animated,
  SafeAreaView,
  Platform,
  RefreshControl,
  BackHandler,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../App';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

// Components
import FeatureCard from '../components/FeatureCard';
import ProfileBanner from '../components/ProfileBanner';
import NotificationBadge from '../components/NotificationBadge';
import StatsCard from '../components/StatsCard';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#4F46E5'; // Standardized primary color

// API configuration
const API_URL = 'http://192.168.29.148:5000'; // Change this to your server IP/domain
const API_TIMEOUT = 15000; // 15 seconds timeout

// Create an axios instance with timeout configuration
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
});

// Add an interceptor to inject the token for authenticated requests
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

interface Feature {
  id: string;
  title: string;
  icon: string;
  destination: keyof RootStackParamList;
}

interface StudentData {
  name: string;
  id: string;
  class: string;
  phone: string;
  email: string;
  imageUrl: string;
}

interface StatsData {
  title: string;
  value: string;
  icon: string;
  color: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  day: string;
  month: string;
  startTime: string;
  endTime: string;
  hasReminder?: boolean;
}

const StudentHomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState(0);
  const isFocused = useIsFocused();
  
  // Backend data states
  const [isLoading, setIsLoading] = useState(true);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [statsData, setStatsData] = useState<StatsData[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  
  // Track if animation has already played
  const animationPlayed = useRef(false);

  // Disable back navigation on this screen - this works globally for the screen
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        // Return true to prevent default back navigation
        return true;
      };

      // Add back handler when screen is focused
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        // Remove back handler when screen is unfocused
        subscription.remove();
      };
    }, [])
  );

  // Prevent back navigation in the navigation stack as well
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
      headerLeft: () => null, // Remove back button
      gestureEnabled: false, // Disable swipe back gesture (for iOS)
    });
  }, [navigation]);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      
      // Refresh data if connection is restored
      if (state.isConnected && !isLoading && error) {
        fetchStudentData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isLoading, error]);

  // Animation handling - Initial setup - only play animation once when component mounts
  useEffect(() => {
    if (!animationPlayed.current) {
      // Initial animation setup
      resetAnimations();
      startAnimations();
      // Mark animation as played
      animationPlayed.current = true;
    } else {
      // If animation has already played, set values to final state
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      headerOpacity.setValue(1);
    }
  }, []); // Only run once on mount

  // Fetch all student data on component mount and when focused
  useEffect(() => {
    if (isFocused) {
      fetchStudentData();
    }
  }, [isFocused]);

  const resetAnimations = () => {
    // Reset animation values
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    headerOpacity.setValue(0);
  };

  const startAnimations = () => {
    // Start animations
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

  // Handle API errors
  const handleApiError = (error: any) => {
    console.error("API error:", error);
    
    if (!isConnected) {
      setError("You're offline. Please check your internet connection.");
      return;
    }
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        setError("Server timeout. Please try again later.");
      } else if (error.response) {
        // Server responded with error status code
        if (error.response.status === 401) {
          // Unauthorized - token might be expired
          handleUnauthorizedError();
        } else {
          setError(error.response.data?.message || `Server error (${error.response.status})`);
        }
      } else if (error.request) {
        // Request made but no response received
        setError(`Could not reach the server. Please check your connection.`);
      } else {
        setError("An error occurred with the request.");
      }
    } else {
      setError("An unexpected error occurred.");
    }
  };

  // Handle unauthorized errors (expired token, etc.)
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

  // Fetch all necessary student data
  const fetchStudentData = async () => {
    if (!isConnected) {
      setError("You're offline. Please check your internet connection.");
      setIsLoading(false);
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Get stored student data first (for immediate display)
      const storedData = await AsyncStorage.getItem('studentData');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setBasicStudentData(parsedData);
      } else {
        // If no stored data, set default data
        setDefaultStudentData();
      }
      
      // Set default stats since we don't have an API endpoint yet
      setDefaultStats();
      
      // Set default events since we don't have an API endpoint yet
      setDefaultEvents();
      
      // For now, since the API endpoints are not ready, just show some notifications
      setNotifications(3);
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching student data:", error);
      handleApiError(error);
      setIsLoading(false);
    }
  };

  // Set default student data if none is available
  const setDefaultStudentData = () => {
    setStudentData({
      name: 'John Doe',
      id: 'STU12345',
      class: 'Class XII-A',
      phone: '+91 9876543210',
      email: 'john.doe@example.com',
      imageUrl: "https://cdn-icons-png.freepik.com/512/11327/11327618.png"
    });
  };

  // Set basic student data from stored or fetched profile
  const setBasicStudentData = (data: any) => {
    // Transform the API response to match our component's expected format
    setStudentData({
      name: data.name || 'Student Name',
      id: data.studentId || data.id || 'ID Not Available',
      class: data.className ? `${data.className} ${data.section || ''}` : 'Class Not Available',
      phone: data.phone || data.phoneNumber || 'Phone Not Available',
      email: data.email || 'Email Not Available',
      imageUrl: data.profileImage || data.imageUrl || "https://cdn-icons-png.freepik.com/512/11327/11327618.png"
    });
  };

  // Set default stats
  const setDefaultStats = () => {
    setStatsData([
      { title: "Attendance", value: "92%", icon: "calendar-check", color: PRIMARY_COLOR },
      { title: "Assignments", value: "18/20", icon: "tasks", color: PRIMARY_COLOR },
      { title: "Average", value: "A", icon: "award", color: PRIMARY_COLOR }
    ]);
  };

  // Set default events
  const setDefaultEvents = () => {
    const currentDate = new Date();
    
    setUpcomingEvents([
      {
        id: "default1",
        title: "Science Project Submission",
        date: currentDate.toISOString(),
        day: "15",
        month: "MAY",
        startTime: "10:30 AM",
        endTime: "12:30 PM"
      },
      {
        id: "default2",
        title: "Mathematics Quiz",
        date: new Date(currentDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        day: "18",
        month: "MAY",
        startTime: "09:00 AM",
        endTime: "10:00 AM"
      }
    ]);
  };

  // Pull-to-refresh handler
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchStudentData().finally(() => {
      setRefreshing(false);
    });
  }, []);

  // Feature navigation data - all using the same PRIMARY_COLOR
  const features: Feature[] = [
    { id: "1", title: "Attendance", icon: "calendar", destination: "StudentAttendance" },
    { id: "2", title: "Academics", icon: "book", destination: "StudentAcademics" },
    { id: "3", title: "Calendar", icon: "calendar-alt", destination: "StudentCalendar" },
    { id: "4", title: "Conduct", icon: "medal", destination: "StudentConduct" },
    { id: "5", title: "Chatroom", icon: "comments", destination: "StudentChatroom" },
    { id: "6", title: "Query", icon: "question-circle", destination: "StudentQuery" },
    { id: "7", title: "Submission", icon: "file-upload", destination: "StudentSubmission" }
  ];

  // Handle navigation to screens
  const handleNavigation = (destination: keyof RootStackParamList) => {
    navigation.navigate(destination);
  };

  // Handle settings press
  const handleSettingsPress = () => {
    navigation.navigate('StudentSettings');
  };

  // Handle notification press
  const handleNotificationPress = () => {
    navigation.navigate('StudentNotifications');
    setNotifications(0);
  };

  // Handle event reminder toggle
  const toggleEventReminder = async (eventId: string) => {
    // Since we don't have a backend yet, just update the local state
    setUpcomingEvents(prevEvents => 
      prevEvents.map(event => 
        event.id === eventId 
          ? { ...event, hasReminder: !event.hasReminder }
          : event
      )
    );
  };

  // Handle logout
  const handleLogout = async () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear stored data
              await AsyncStorage.multiRemove(['studentToken', 'studentData']);
              
              // Navigate to login screen
              navigation.replace('StudentLogin');
            } catch (error) {
              console.error("Error during logout:", error);
              Alert.alert("Error", "Failed to log out. Please try again.");
            }
          }
        }
      ]
    );
  };

  // Show loading state if initial data is loading
  if (isLoading && !studentData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading your data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error && !isLoading && !studentData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={60} color="#8A94A6" />
          <Text style={styles.errorTitle}>Connection Problem</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchStudentData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      {/* Custom Header Section */}
      <Animated.View 
        style={[
          styles.header, 
          { 
            opacity: headerOpacity,
            paddingTop: insets.top > 0 ? 0 : 20 
          }
        ]}
      >
        <View style={styles.headerLeftSection}>
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }]
          }}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../assets/images/logo.png')} 
                style={styles.logo} 
                resizeMode="contain"
              />
              <Text style={styles.appName}>Vidyarthi</Text>
            </View>
          </Animated.View>
        </View>
        
        <View style={styles.headerRightSection}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleNotificationPress}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color={PRIMARY_COLOR} />
            {notifications > 0 && (
              <NotificationBadge count={notifications} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleSettingsPress}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </View>
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
        {/* Welcome Section */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}
        >
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.nameText}>{studentData?.name || 'Student'}</Text>
          </View>
        </Animated.View>

        {/* Profile Banner */}
        {studentData && (
          <ProfileBanner 
            student={studentData}
            fadeAnim={fadeAnim}
            slideAnim={slideAnim}
            onPress={() => navigation.navigate('StudentProfile')}
          />
        )}

        {/* Stats Section */}
        <View style={styles.statsSection}>
          {statsData.map((stat, index) => (
            <StatsCard 
              key={index}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              index={index}
            />
          ))}
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>Student Portal</Text>
            <TouchableOpacity onPress={() => {}} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.id}
                title={feature.title}
                icon={feature.icon}
                color={PRIMARY_COLOR}
                index={index}
                onPress={() => handleNavigation(feature.destination)}
              />
            ))}
          </View>
        </View>

        {/* Upcoming Section */}
        <View style={styles.upcomingSection}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            <TouchableOpacity onPress={() => navigation.navigate('StudentCalendar')} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={[styles.eventDateBox, { backgroundColor: PRIMARY_COLOR }]}>
                  <Text style={styles.eventDateDay}>{event.day}</Text>
                  <Text style={styles.eventDateMonth}>{event.month}</Text>
                </View>
                <View style={styles.eventDetails}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={styles.eventTimeContainer}>
                    <Feather name="clock" size={14} color="#8A94A6" />
                    <Text style={styles.eventTime}>{event.startTime} - {event.endTime}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.eventReminderButton,
                    event.hasReminder && styles.eventReminderActive
                  ]}
                  onPress={() => toggleEventReminder(event.id)}
                  activeOpacity={0.7}
                >
                  <Feather name="bell" size={16} color={event.hasReminder ? "#FFFFFF" : PRIMARY_COLOR} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.noEventsContainer}>
              <Feather name="calendar" size={40} color="#8A94A6" style={{ opacity: 0.5 }} />
              <Text style={styles.noEventsText}>No upcoming events</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.helpButton} activeOpacity={0.8}>
            <Feather name="help-circle" size={16} color="#8A94A6" style={styles.helpIcon} />
            <Text style={styles.footerText}>Need help? Contact support</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={16} color="#FF6B6B" style={styles.logoutIcon} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
          
          <Text style={styles.version}>Student Portal v2.4.1</Text>
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
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 20, // Ensure consistent padding at the bottom
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
  headerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
    marginLeft: 8,
  },
  headerRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  welcomeContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '300',
    color: '#3A4276',
  },
  nameText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3A4276',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    marginTop: 10,
  },
  featuresSection: {
    marginBottom: 30,
  },
  featuresGrid: {
    width: '100%',
    marginTop: 8, // Consistent spacing
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12, // Consistent spacing
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    opacity: 0.9,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  upcomingSection: {
    marginBottom: 30,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventDateBox: {
    width: 50,
    height: 60,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  eventDateDay: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  eventDateMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 14,
    color: '#8A94A6',
    marginLeft: 6,
  },
  eventReminderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F1F6',
  },
  eventReminderActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  noEventsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  noEventsText: {
    fontSize: 14,
    marginTop: 10,
    color: '#8A94A6',
  },
  footer: {
    marginTop: 10,
    marginBottom: Platform.OS === 'ios' ? 30 : 20,
    alignItems: 'center',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(138, 148, 166, 0.1)',
    marginBottom: 8,
  },
  helpIcon: {
    marginRight: 6,
  },
  footerText: {
    fontSize: 14,
    color: '#8A94A6',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    marginBottom: 16,
  },
  logoutIcon: {
    marginRight: 6,
  },
  logoutText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  version: {
    fontSize: 12,
    color: '#B0B7C3',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 30,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  }
});

export default StudentHomeScreen;