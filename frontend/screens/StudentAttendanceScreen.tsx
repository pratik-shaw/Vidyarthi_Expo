// StudentAttendanceScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { STUDENT_API } from '../config/api';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#4F46E5';

// API configuration
const API_URL = STUDENT_API;
const API_TIMEOUT = 15000;

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
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
  (error) => Promise.reject(error)
);

// Interface definitions
interface StudentInfo {
  id: string;
  name: string;
  email: string;
  studentId: string;
  className: string;
  section: string;
  schoolName: string;
}

interface OverallStats {
  totalDaysRecorded: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  attendancePercentage: number;
  absentPercentage: number;
  latePercentage: number;
  punctualityScore: number;
}

interface Streaks {
  currentStreak: {
    type: string;
    count: number;
  };
  longestPresentStreak: number;
  longestAbsentStreak: number;
}

interface MonthlyBreakdown {
  month: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendancePercentage: number;
  absentPercentage: number;
  latePercentage: number;
}

interface AttendanceRecord {
  date: string;
  fullDate: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks: string;
  classSize: number;
}

interface Trends {
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  change: number;
}

interface Insight {
  type: 'positive' | 'warning' | 'neutral' | 'suggestion' | 'achievement';
  title: string;
  message: string;
}

interface AttendanceData {
  success: boolean;
  studentInfo: StudentInfo;
  overallStats: OverallStats;
  streaks: Streaks;
  monthlyBreakdown: MonthlyBreakdown[];
  recentAttendance: AttendanceRecord[];
  trends: Trends;
  insights: Insight[];
  dateRange: {
    startDate: string;
    endDate: string;
    totalDaysRecorded: number;
  } | null;
  filters: {
    timeframe: string;
    startDate: string | null;
    endDate: string | null;
  };
}

const StudentAttendanceScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  // State management
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('all');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Timeframe options
  const timeframes = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'semester', label: 'Semester' },
    { key: 'year', label: 'This Year' },
    { key: 'all', label: 'All Time' }
  ];

  useEffect(() => {
    fetchAttendanceData();
    startAnimations();
  }, []);

  useEffect(() => {
    if (selectedTimeframe) {
      fetchAttendanceData();
    }
  }, [selectedTimeframe]);

  const startAnimations = () => {
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
  };

  const fetchAttendanceData = async () => {
    try {
      setError(null);
      
      // Get student data from storage to get studentId
      const storedData = await AsyncStorage.getItem('studentData');
      if (!storedData) {
        throw new Error('Student data not found. Please log in again.');
      }
      
      const studentData = JSON.parse(storedData);
      const studentId = studentData.id || studentData._id;
      
      if (!studentId) {
        throw new Error('Student ID not found. Please log in again.');
      }

      console.log('Fetching attendance data for student:', studentId, 'timeframe:', selectedTimeframe);
      
      const response = await apiClient.get(`/api/attendance/student/${studentId}/stats`, {
        params: {
          timeframe: selectedTimeframe
        }
      });

      if (response.data && response.data.success) {
        console.log('Attendance data fetched successfully:', response.data);
        setAttendanceData(response.data);
      } else {
        throw new Error(response.data?.msg || 'Failed to fetch attendance data');
      }
      
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiError = (error: any) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please log in again.",
          [{ text: "OK", onPress: () => navigation.replace('StudentLogin') }]
        );
        return;
      } else if (error.response?.status === 403) {
        setError("You don't have permission to view this data.");
      } else if (error.response?.status === 404) {
        if (error.response.data?.msg?.includes('not assigned to any class')) {
          setError("You are not assigned to any class yet. Please contact your school admin.");
        } else {
          setError("Attendance data not found.");
        }
      } else if (error.code === 'ECONNABORTED') {
        setError("Request timeout. Please check your internet connection.");
      } else if (error.response) {
        setError(error.response.data?.msg || `Server error (${error.response.status})`);
      } else if (error.request) {
        setError("Could not reach the server. Please check your connection.");
      } else {
        setError("An error occurred while fetching data.");
      }
    } else {
      setError(error.message || "An unexpected error occurred.");
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchAttendanceData().finally(() => {
      setRefreshing(false);
    });
  }, [selectedTimeframe]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return '#22C55E';
      case 'absent': return '#EF4444';
      case 'late': return '#F59E0B';
      case 'excused': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return 'check-circle';
      case 'absent': return 'x-circle';
      case 'late': return 'clock';
      case 'excused': return 'info';
      default: return 'help-circle';
    }
  };

  const getInsightIcon = (type: string) => {
  switch (type) {
    case 'positive': return 'trending-up';
    case 'warning': return 'alert-triangle';
    case 'achievement': return 'award';
    case 'suggestion': return 'zap'; // Changed from 'lightbulb' to 'zap'
    default: return 'info';
  }
};

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'positive': return '#22C55E';
      case 'warning': return '#EF4444';
      case 'achievement': return '#8B5CF6';
      case 'suggestion': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={24} color={PRIMARY_COLOR} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>My Attendance</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  const renderTimeframeSelector = () => (
    <View style={styles.timeframeContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timeframeScrollContent}
      >
        {timeframes.map((timeframe) => (
          <TouchableOpacity
            key={timeframe.key}
            style={[
              styles.timeframeButton,
              selectedTimeframe === timeframe.key && styles.timeframeButtonActive
            ]}
            onPress={() => setSelectedTimeframe(timeframe.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.timeframeButtonText,
                selectedTimeframe === timeframe.key && styles.timeframeButtonTextActive
              ]}
            >
              {timeframe.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderOverallStats = () => {
    if (!attendanceData?.overallStats) return null;

    const { overallStats } = attendanceData;

    return (
      <Animated.View
        style={[
          styles.statsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={[PRIMARY_COLOR, '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainStatsCard}
        >
          <Text style={styles.mainStatsTitle}>Overall Attendance</Text>
          <Text style={styles.mainStatsPercentage}>
            {overallStats.attendancePercentage}%
          </Text>
          <Text style={styles.mainStatsSubtitle}>
            {overallStats.presentDays} present of {overallStats.totalDaysRecorded} days
          </Text>
        </LinearGradient>

        <View style={styles.subStatsContainer}>
          <View style={styles.subStatsCard}>
            <Feather name="x-circle" size={20} color="#EF4444" />
            <Text style={styles.subStatsValue}>{overallStats.absentPercentage}%</Text>
            <Text style={styles.subStatsLabel}>Absent</Text>
          </View>
          
          <View style={styles.subStatsCard}>
            <Feather name="clock" size={20} color="#F59E0B" />
            <Text style={styles.subStatsValue}>{overallStats.latePercentage}%</Text>
            <Text style={styles.subStatsLabel}>Late</Text>
          </View>
          
          <View style={styles.subStatsCard}>
            <Feather name="star" size={20} color="#8B5CF6" />
            <Text style={styles.subStatsValue}>{overallStats.punctualityScore}%</Text>
            <Text style={styles.subStatsLabel}>Punctuality</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderStreaks = () => {
    if (!attendanceData?.streaks) return null;

    const { streaks } = attendanceData;

    return (
      <Animated.View
        style={[
          styles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.sectionTitle}>Streaks</Text>
        
        <View style={styles.streaksContainer}>
          <View style={styles.streakCard}>
            <View style={[styles.streakIcon, { backgroundColor: `${getStatusColor(streaks.currentStreak.type)}15` }]}>
              <Feather 
                name={getStatusIcon(streaks.currentStreak.type)} 
                size={20} 
                color={getStatusColor(streaks.currentStreak.type)} 
              />
            </View>
            <Text style={styles.streakValue}>{streaks.currentStreak.count}</Text>
            <Text style={styles.streakLabel}>Current {streaks.currentStreak.type}</Text>
          </View>
          
          <View style={styles.streakCard}>
            <View style={[styles.streakIcon, { backgroundColor: '#22C55E15' }]}>
              <Feather name="trending-up" size={20} color="#22C55E" />
            </View>
            <Text style={styles.streakValue}>{streaks.longestPresentStreak}</Text>
            <Text style={styles.streakLabel}>Best Present</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderMonthlyBreakdown = () => {
    if (!attendanceData?.monthlyBreakdown || attendanceData.monthlyBreakdown.length === 0) return null;

    return (
      <Animated.View
        style={[
          styles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
        
        {attendanceData.monthlyBreakdown.map((month, index) => (
          <View key={index} style={styles.monthCard}>
            <View style={styles.monthHeader}>
              <Text style={styles.monthName}>{month.month}</Text>
              <Text style={styles.monthPercentage}>{month.attendancePercentage}%</Text>
            </View>
            
            <View style={styles.monthStats}>
              <View style={styles.monthStat}>
                <View style={[styles.monthStatDot, { backgroundColor: '#22C55E' }]} />
                <Text style={styles.monthStatText}>Present: {month.present}</Text>
              </View>
              
              <View style={styles.monthStat}>
                <View style={[styles.monthStatDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.monthStatText}>Absent: {month.absent}</Text>
              </View>
              
              {month.late > 0 && (
                <View style={styles.monthStat}>
                  <View style={[styles.monthStatDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.monthStatText}>Late: {month.late}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      width: `${month.attendancePercentage}%`,
                      backgroundColor: month.attendancePercentage >= 75 ? '#22C55E' : '#EF4444'
                    }
                  ]} 
                />
              </View>
            </View>
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderRecentAttendance = () => {
    if (!attendanceData?.recentAttendance || attendanceData.recentAttendance.length === 0) return null;

    return (
      <Animated.View
        style={[
          styles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.sectionTitle}>Recent Attendance</Text>
        
        {attendanceData.recentAttendance.map((record, index) => (
          <View key={index} style={styles.attendanceRecord}>
            <View style={styles.attendanceDate}>
              <Text style={styles.attendanceDateText}>
                {new Date(record.fullDate).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Text>
            </View>
            
            <View style={styles.attendanceStatus}>
              <View style={[styles.statusIcon, { backgroundColor: `${getStatusColor(record.status)}15` }]}>
                <Feather 
                  name={getStatusIcon(record.status)} 
                  size={16} 
                  color={getStatusColor(record.status)} 
                />
              </View>
              <Text style={[styles.statusText, { color: getStatusColor(record.status) }]}>
                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
              </Text>
            </View>
            
            {record.remarks && (
              <Text style={styles.attendanceRemarks}>{record.remarks}</Text>
            )}
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderInsights = () => {
    if (!attendanceData?.insights || attendanceData.insights.length === 0) return null;

    return (
      <Animated.View
        style={[
          styles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.sectionTitle}>Insights & Recommendations</Text>
        
        {attendanceData.insights.map((insight, index) => (
          <View key={index} style={styles.insightCard}>
            <View style={[styles.insightIcon, { backgroundColor: `${getInsightColor(insight.type)}15` }]}>
              <Feather 
                name={getInsightIcon(insight.type)} 
                size={20} 
                color={getInsightColor(insight.type)} 
              />
            </View>
            
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightMessage}>{insight.message}</Text>
            </View>
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderTrends = () => {
    if (!attendanceData?.trends || attendanceData.trends.trend === 'insufficient_data') return null;

    const { trends } = attendanceData;
    const trendColor = trends.trend === 'improving' ? '#22C55E' : trends.trend === 'declining' ? '#EF4444' : '#6B7280';
    const trendIcon = trends.trend === 'improving' ? 'trending-up' : trends.trend === 'declining' ? 'trending-down' : 'minus';

    return (
      <Animated.View
        style={[
          styles.section,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.sectionTitle}>Attendance Trend</Text>
        
        <View style={styles.trendCard}>
          <View style={[styles.trendIcon, { backgroundColor: `${trendColor}15` }]}>
            <Feather name={trendIcon} size={24} color={trendColor} />
          </View>
          
          <View style={styles.trendContent}>
            <Text style={[styles.trendLabel, { color: trendColor }]}>
              {trends.trend.charAt(0).toUpperCase() + trends.trend.slice(1)}
            </Text>
            <Text style={styles.trendDescription}>
              {trends.change > 0 ? '+' : ''}{trends.change}% compared to last month
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Loading state
  if (isLoading && !attendanceData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading attendance data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !attendanceData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={60} color="#8A94A6" />
          <Text style={styles.errorTitle}>Unable to Load Data</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchAttendanceData}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      {renderHeader()}
      
      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
      >
        {renderTimeframeSelector()}
        {renderOverallStats()}
        {renderStreaks()}
        {renderTrends()}
        {renderMonthlyBreakdown()}
        {renderRecentAttendance()}
        {renderInsights()}
        
        {/* Date Range Info */}
        {attendanceData?.dateRange && (
          <View style={styles.dateRangeInfo}>
            <Text style={styles.dateRangeText}>
              Data from {new Date(attendanceData.dateRange.startDate).toLocaleDateString()} to{' '}
              {new Date(attendanceData.dateRange.endDate).toLocaleDateString()}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  timeframeContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timeframeScrollContent: {
    paddingHorizontal: 20,
  },
  timeframeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  timeframeButtonActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  timeframeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  timeframeButtonTextActive: {
    color: '#FFFFFF',
  },
  statsContainer: {
    padding: 20,
  },
  mainStatsCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  mainStatsTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 8,
  },
  mainStatsPercentage: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mainStatsSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  subStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subStatsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  subStatsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  subStatsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  streaksContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  streakIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  streakValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  monthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  monthPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  monthStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  monthStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  monthStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  monthStatText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  attendanceRecord: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  attendanceDate: {
    minWidth: 80,
    marginRight: 16,
  },
  attendanceDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  attendanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  attendanceRemarks: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginLeft: 44,
    marginTop: 4,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  insightMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  trendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  trendIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  trendContent: {
    flex: 1,
  },
  trendLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  trendDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  dateRangeInfo: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    margin: 20,
    marginTop: 0,
  },
  dateRangeText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StudentAttendanceScreen;