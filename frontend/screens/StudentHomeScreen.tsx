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
  BackHandler
} from 'react-native';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../App';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Components
import FeatureCard from '../components/FeatureCard';
import ProfileBanner from '../components/ProfileBanner';
import NotificationBadge from '../components/NotificationBadge';
import StatsCard from '../components/StatsCard';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#4F46E5'; // Standardized primary color

interface Feature {
  id: string;
  title: string;
  icon: string;
  destination: keyof RootStackParamList;
}

const StudentHomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState(3);
  const isFocused = useIsFocused();
  
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

  // Remove the useFocusEffect that was restarting animations on each screen focus

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

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Simulate data fetching
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  // Student profile data
  const studentData = {
    name: "Pratik Shaw",
    id: "ABS-20222119",
    class: "10 (Science)",
    phone: "7003390611",
    email: "main.pratikshaw@gmail.com",
    imageUrl: "https://cdn-icons-png.freepik.com/512/11327/11327618.png"
  };

  // Statistical data
  const statsData = [
    { title: "Attendance", value: "92%", icon: "calendar-check", color: PRIMARY_COLOR },
    { title: "Assignments", value: "18/20", icon: "tasks", color: PRIMARY_COLOR },
    { title: "Average", value: "A+", icon: "award", color: PRIMARY_COLOR }
  ];

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
            <Text style={styles.nameText}>{studentData.name}</Text>
          </View>
        </Animated.View>

        {/* Profile Banner */}
        <ProfileBanner 
          student={studentData}
          fadeAnim={fadeAnim}
          slideAnim={slideAnim}
          onPress={() => navigation.navigate('StudentProfile')}
        />

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
          
          <View style={styles.eventCard}>
            <View style={[styles.eventDateBox, { backgroundColor: PRIMARY_COLOR }]}>
              <Text style={styles.eventDateDay}>15</Text>
              <Text style={styles.eventDateMonth}>MAY</Text>
            </View>
            <View style={styles.eventDetails}>
              <Text style={styles.eventTitle}>Science Project Submission</Text>
              <View style={styles.eventTimeContainer}>
                <Feather name="clock" size={14} color="#8A94A6" />
                <Text style={styles.eventTime}>10:30 AM - 12:30 PM</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.eventReminderButton}
              onPress={() => {}}
              activeOpacity={0.7}
            >
              <Feather name="bell" size={16} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>

          <View style={styles.eventCard}>
            <View style={[styles.eventDateBox, { backgroundColor: PRIMARY_COLOR }]}>
              <Text style={styles.eventDateDay}>18</Text>
              <Text style={styles.eventDateMonth}>MAY</Text>
            </View>
            <View style={styles.eventDetails}>
              <Text style={styles.eventTitle}>Mathematics Quiz</Text>
              <View style={styles.eventTimeContainer}>
                <Feather name="clock" size={14} color="#8A94A6" />
                <Text style={styles.eventTime}>09:00 AM - 10:00 AM</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.eventReminderButton}
              onPress={() => {}}
              activeOpacity={0.7}
            >
              <Feather name="bell" size={16} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.helpButton} activeOpacity={0.8}>
            <Feather name="help-circle" size={16} color="#8A94A6" style={styles.helpIcon} />
            <Text style={styles.footerText}>Need help? Contact support</Text>
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
  version: {
    fontSize: 12,
    color: '#B0B7C3',
  },
});

export default StudentHomeScreen;