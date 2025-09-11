// StudentConductScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Animated,
  RefreshControl,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STUDENT_API } from '../config/api';
import { RootStackParamList } from '../App';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#4F46E5'; // Consistent with attendance screen
const POSITIVE_COLOR = '#22C55E'; // Updated to match attendance screen
const NEGATIVE_COLOR = '#EF4444';
const NEUTRAL_COLOR = '#6B7280';

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

interface ConductRecord {
  _id: string;
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  actionTaken?: string;
  parentNotified: boolean;
  followUpRequired: boolean;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;
  teacherId: {
    _id: string;
    name: string;
    email: string;
  };
  classId: {
    _id: string;
    name: string;
    section: string;
  };
}

interface ConductSummary {
  totalRecords: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positivePercentage: string;
  negativePercentage: string;
  neutralPercentage: string;
  recentTrends: Array<{
    month: string;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  }>;
}

interface StudentInfo {
  id: string;
  name: string;
  studentId: string;
  className: string;
  section: string;
}

interface ConductData {
  hasData: boolean;
  conducts: ConductRecord[];
  summary: ConductSummary;
  studentInfo: StudentInfo;
  totalRecords: number;
  lastUpdated: string;
}

const StudentConductScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  
  const [conductData, setConductData] = useState<ConductData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'records' | 'overview' | 'summary' | 'trends'>('records');
  const [selectedType, setSelectedType] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });

    fetchConductData();
    startAnimations();
  }, [navigation]);

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
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ]).start();
  };

  const fetchConductData = async () => {
    try {
      setError(null);
      const response = await apiClient.get('/api/conduct/student/my-conduct');
      setConductData(response.data);
    } catch (err: any) {
      console.error('Error fetching conduct data:', err);
      handleApiError(err);
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
        setError("Conduct data not found.");
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
    fetchConductData().finally(() => {
      setRefreshing(false);
    });
  }, []);

  const getConductTypeColor = (type: string) => {
    switch (type) {
      case 'positive': return POSITIVE_COLOR;
      case 'negative': return NEGATIVE_COLOR;
      case 'neutral': return NEUTRAL_COLOR;
      default: return '#6B7280';
    }
  };

  const getConductTypeIcon = (type: string) => {
    switch (type) {
      case 'positive': return 'thumbs-up';
      case 'negative': return 'thumbs-down';
      case 'neutral': return 'minus';
      default: return 'help-circle';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return POSITIVE_COLOR;
      case 'medium': return '#F59E0B';
      case 'high': return NEGATIVE_COLOR;
      default: return '#6B7280';
    }
  };

  const getFilteredRecords = () => {
    if (!conductData?.conducts) return [];
    if (selectedType === 'all') return conductData.conducts;
    return conductData.conducts.filter(record => record.type === selectedType);
  };

  const renderHeader = () => (
    <Animated.View 
      style={[
        styles.header, 
        { 
          opacity: headerOpacity,
          paddingTop: insets.top > 0 ? 0 : 20 
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={24} color={PRIMARY_COLOR} />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>My Conduct</Text>
      
      <View style={styles.headerSpacer} />
    </Animated.View>
  );

  const renderTabSelector = () => (
    <Animated.View
      style={[
        styles.tabContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScrollContent}
      >
        {[
          { key: 'records', label: 'Records', icon: 'list' },
          { key: 'overview', label: 'Overview', icon: 'pie-chart' },
          { key: 'summary', label: 'Summary', icon: 'bar-chart-2' },
          { key: 'trends', label: 'Trends', icon: 'trending-up' }
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              selectedTab === tab.key && styles.tabButtonActive
            ]}
            onPress={() => setSelectedTab(tab.key as any)}
            activeOpacity={0.7}
          >
            <Feather 
              name={tab.icon as any} 
              size={16} 
              color={selectedTab === tab.key ? '#FFFFFF' : PRIMARY_COLOR} 
            />
            <Text
              style={[
                styles.tabButtonText,
                selectedTab === tab.key && styles.tabButtonTextActive
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );

  const renderRecordsTab = () => {
    const filteredRecords = getFilteredRecords();

    if (!conductData?.hasData || filteredRecords.length === 0) {
      return (
        <Animated.View
          style={[
            styles.noDataContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Ionicons name="document-outline" size={60} color="#8A94A6" />
          <Text style={styles.noDataTitle}>No Records Found</Text>
          <Text style={styles.noDataText}>
            {selectedType === 'all' 
              ? 'No conduct records available.'
              : `No ${selectedType} conduct records found.`}
          </Text>
        </Animated.View>
      );
    }

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
        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'all', label: 'All', count: conductData.conducts.length },
              { key: 'positive', label: 'Positive', count: conductData.summary.positiveCount },
              { key: 'negative', label: 'Negative', count: conductData.summary.negativeCount },
              { key: 'neutral', label: 'Neutral', count: conductData.summary.neutralCount }
            ].map((filter) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterButton,
                  selectedType === filter.key && styles.filterButtonActive,
                  selectedType === filter.key && { backgroundColor: getConductTypeColor(filter.key === 'all' ? 'positive' : filter.key) }
                ]}
                onPress={() => setSelectedType(filter.key as any)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedType === filter.key && styles.filterButtonTextActive
                ]}>
                  {filter.label} ({filter.count})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Conduct Records */}
        {filteredRecords.map((record, index) => (
          <View key={record._id} style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View style={styles.recordTitleRow}>
                <Text style={styles.recordTitle}>{record.title}</Text>
                <View style={[
                  styles.typeChip,
                  { backgroundColor: getConductTypeColor(record.type) + '15' }
                ]}>
                  <Feather 
                    name={getConductTypeIcon(record.type) as any} 
                    size={12} 
                    color={getConductTypeColor(record.type)} 
                  />
                  <Text style={[
                    styles.typeChipText,
                    { color: getConductTypeColor(record.type) }
                  ]}>
                    {record.type.charAt(0).toUpperCase() + record.type.slice(1)}
                  </Text>
                </View>
              </View>
              <Text style={styles.recordDescription}>{record.description}</Text>
              <Text style={styles.recordDate}>
                {new Date(record.createdAt).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>

            <View style={styles.recordDetails}>
              <View style={styles.recordMeta}>
                <View style={styles.metaItem}>
                  <Feather name="user" size={14} color="#8A94A6" />
                  <Text style={styles.metaText}>{record.teacherId.name}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="home" size={14} color="#8A94A6" />
                  <Text style={styles.metaText}>
                    {record.classId.name} - {record.classId.section}
                  </Text>
                </View>
              </View>

              <View style={styles.recordFlags}>
                <View style={[
                  styles.severityChip,
                  { backgroundColor: getSeverityColor(record.severity) + '15' }
                ]}>
                  <Text style={[
                    styles.severityChipText,
                    { color: getSeverityColor(record.severity) }
                  ]}>
                    {record.severity.toUpperCase()}
                  </Text>
                </View>
                {record.parentNotified && (
                  <View style={styles.flagChip}>
                    <Feather name="mail" size={12} color="#3B82F6" />
                    <Text style={styles.flagText}>Parent Notified</Text>
                  </View>
                )}
                {record.followUpRequired && (
                  <View style={styles.flagChip}>
                    <Feather name="clock" size={12} color="#F59E0B" />
                    <Text style={styles.flagText}>Follow-up Required</Text>
                  </View>
                )}
              </View>

              {record.actionTaken && (
                <View style={styles.actionTaken}>
                  <Text style={styles.actionLabel}>Action Taken:</Text>
                  <Text style={styles.actionText}>{record.actionTaken}</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </Animated.View>
    );
  };

  const renderOverviewTab = () => {
    if (!conductData || !conductData.hasData) {
      return (
        <Animated.View
          style={[
            styles.noDataContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Ionicons name="clipboard-outline" size={60} color="#8A94A6" />
          <Text style={styles.noDataTitle}>No Conduct Records</Text>
          <Text style={styles.noDataText}>
            Your conduct records will appear here once they are created by your teachers.
          </Text>
        </Animated.View>
      );
    }

    const { summary } = conductData;

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
        {/* Overall Conduct Card */}
        <LinearGradient
          colors={[PRIMARY_COLOR, '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainStatsCard}
        >
          <Text style={styles.mainStatsTitle}>Overall Conduct</Text>
          <Text style={styles.mainStatsPercentage}>
            {summary.positiveCount > summary.negativeCount ? 'Good' : 
             summary.negativeCount > summary.positiveCount ? 'Needs Improvement' : 'Average'}
          </Text>
          <Text style={styles.mainStatsSubtitle}>
            {summary.totalRecords} Total Records
          </Text>
        </LinearGradient>

        {/* Quick Stats Grid */}
        <View style={styles.subStatsContainer}>
          <View style={styles.subStatsCard}>
            <View style={[styles.subStatsIcon, { backgroundColor: POSITIVE_COLOR + '15' }]}>
              <Feather name="thumbs-up" size={20} color={POSITIVE_COLOR} />
            </View>
            <Text style={styles.subStatsValue}>{summary.positiveCount}</Text>
            <Text style={styles.subStatsLabel}>Positive</Text>
            <Text style={styles.subStatsPercentage}>{summary.positivePercentage}%</Text>
          </View>
          
          <View style={styles.subStatsCard}>
            <View style={[styles.subStatsIcon, { backgroundColor: NEGATIVE_COLOR + '15' }]}>
              <Feather name="thumbs-down" size={20} color={NEGATIVE_COLOR} />
            </View>
            <Text style={styles.subStatsValue}>{summary.negativeCount}</Text>
            <Text style={styles.subStatsLabel}>Negative</Text>
            <Text style={styles.subStatsPercentage}>{summary.negativePercentage}%</Text>
          </View>
          
          <View style={styles.subStatsCard}>
            <View style={[styles.subStatsIcon, { backgroundColor: NEUTRAL_COLOR + '15' }]}>
              <Feather name="minus" size={20} color={NEUTRAL_COLOR} />
            </View>
            <Text style={styles.subStatsValue}>{summary.neutralCount}</Text>
            <Text style={styles.subStatsLabel}>Neutral</Text>
            <Text style={styles.subStatsPercentage}>{summary.neutralPercentage}%</Text>
          </View>
        </View>

        {/* Conduct Distribution Chart */}
        {summary.totalRecords > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionTitle}>Conduct Distribution</Text>
              <Text style={styles.chartSubtitle}>All time records</Text>
            </View>
            <PieChart
              data={[
                {
                  name: 'Positive',
                  population: summary.positiveCount,
                  color: POSITIVE_COLOR,
                  legendFontColor: '#3A4276',
                  legendFontSize: 12
                },
                {
                  name: 'Negative',
                  population: summary.negativeCount,
                  color: NEGATIVE_COLOR,
                  legendFontColor: '#3A4276',
                  legendFontSize: 12
                },
                {
                  name: 'Neutral',
                  population: summary.neutralCount,
                  color: NEUTRAL_COLOR,
                  legendFontColor: '#3A4276',
                  legendFontSize: 12
                }
              ].filter(item => item.population > 0)}
              width={width - 80}
              height={200}
              chartConfig={{
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              hasLegend={true}
            />
          </View>
        )}

        {/* Recent Trends */}
        {summary.recentTrends.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionTitle}>Monthly Trends</Text>
              <Text style={styles.chartSubtitle}>Last 6 months</Text>
            </View>
            <LineChart
              data={{
                labels: summary.recentTrends.map(trend => trend.month.split('-')[1]),
                datasets: [
                  {
                    data: summary.recentTrends.map(trend => trend.positive),
                    color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
                    strokeWidth: 2
                  },
                  {
                    data: summary.recentTrends.map(trend => trend.negative),
                    color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                    strokeWidth: 2
                  }
                ]
              }}
              width={width - 80}
              height={200}
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(138, 148, 166, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: PRIMARY_COLOR
                }
              }}
              bezier
              style={styles.chart}
              withDots={true}
              withShadow={false}
              withVerticalLines={false}
              withHorizontalLines={true}
            />
          </View>
        )}
      </Animated.View>
    );
  };

  const renderSummaryTab = () => {
    if (!conductData?.hasData) {
      return (
        <Animated.View
          style={[
            styles.noDataContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Ionicons name="bar-chart-outline" size={60} color="#8A94A6" />
          <Text style={styles.noDataTitle}>No Summary Data</Text>
          <Text style={styles.noDataText}>Summary statistics will be available once you have conduct records.</Text>
        </Animated.View>
      );
    }

    const { summary, studentInfo } = conductData;

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
        {/* Student Info Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Student Information</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Name</Text>
              <Text style={styles.summaryValue}>{studentInfo.name}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Student ID</Text>
              <Text style={styles.summaryValue}>{studentInfo.studentId}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Class</Text>
              <Text style={styles.summaryValue}>{studentInfo.className} - {studentInfo.section}</Text>
            </View>
          </View>
        </View>

        {/* Overall Statistics */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Overall Statistics</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Records</Text>
              <Text style={styles.summaryValue}>{summary.totalRecords}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Positive Ratio</Text>
              <Text style={[styles.summaryValue, { color: POSITIVE_COLOR }]}>
                {summary.positivePercentage}%
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Negative Ratio</Text>
              <Text style={[styles.summaryValue, { color: NEGATIVE_COLOR }]}>
                {summary.negativePercentage}%
              </Text>
            </View>
          </View>
        </View>

        {/* Conduct Breakdown */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Conduct Breakdown</Text>
          <View style={styles.breakdownContainer}>
            <View style={styles.breakdownItem}>
              <View style={styles.breakdownHeader}>
                <View style={[styles.breakdownIcon, { backgroundColor: POSITIVE_COLOR + '15' }]}>
                  <Feather name="thumbs-up" size={20} color={POSITIVE_COLOR} />
                </View>
                <Text style={styles.breakdownTitle}>Positive Conduct</Text>
              </View>
              <Text style={styles.breakdownCount}>{summary.positiveCount} records</Text>
              <Text style={styles.breakdownPercentage}>{summary.positivePercentage}% of total</Text>
            </View>

            <View style={styles.breakdownItem}>
              <View style={styles.breakdownHeader}>
                <View style={[styles.breakdownIcon, { backgroundColor: NEGATIVE_COLOR + '15' }]}>
                  <Feather name="thumbs-down" size={20} color={NEGATIVE_COLOR} />
                </View>
                <Text style={styles.breakdownTitle}>Negative Conduct</Text>
              </View>
              <Text style={styles.breakdownCount}>{summary.negativeCount} records</Text>
              <Text style={styles.breakdownPercentage}>{summary.negativePercentage}% of total</Text>
            </View>

            <View style={styles.breakdownItem}>
              <View style={styles.breakdownHeader}>
                <View style={[styles.breakdownIcon, { backgroundColor: NEUTRAL_COLOR + '15' }]}>
                  <Feather name="minus" size={20} color={NEUTRAL_COLOR} />
                </View>
                <Text style={styles.breakdownTitle}>Neutral Records</Text>
              </View>
              <Text style={styles.breakdownCount}>{summary.neutralCount} records</Text>
              <Text style={styles.breakdownPercentage}>{summary.neutralPercentage}% of total</Text>
            </View>
          </View>
        </View>

        {/* Last Updated */}
        <View style={styles.dateRangeInfo}>
          <Text style={styles.dateRangeText}>
            Last updated: {new Date(conductData.lastUpdated).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const renderTrendsTab = () => {
    if (!conductData?.hasData || conductData.summary.recentTrends.length === 0) {
      return (
        <Animated.View
          style={[
            styles.noDataContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Ionicons name="trending-up-outline" size={60} color="#8A94A6" />
          <Text style={styles.noDataTitle}>No Trend Data</Text>
          <Text style={styles.noDataText}>Trend analysis will be available once you have more conduct records.</Text>
        </Animated.View>
      );
    }

    const { summary } = conductData;

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
        {/* Monthly Breakdown Chart */}
        <View style={styles.chartCard}>
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
            <Text style={styles.chartSubtitle}>Conduct records by month</Text>
          </View>
          <BarChart
            data={{
              labels: summary.recentTrends.map(trend => trend.month.split('-')[1]),
              datasets: [{
                data: summary.recentTrends.map(trend => trend.total)
              }]
            }}
            width={width - 80}
            height={220}
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: '#FFFFFF',
              backgroundGradientTo: '#FFFFFF',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(138, 148, 166, ${opacity})`,
              style: { borderRadius: 16 }
            }}
            style={styles.chart}
            showValuesOnTopOfBars={true}
            yAxisLabel={''}
            yAxisSuffix={''}
            fromZero={true}
            withVerticalLabels={false}
          />
        </View>

        {/* Monthly Details */}
        {summary.recentTrends.map((trend, index) => (
          <View key={index} style={styles.trendCard}>
            <View style={styles.trendHeader}>
              <Text style={styles.trendMonth}>
                {new Date(trend.month + '-01').toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long'
                })}
              </Text>
              <Text style={styles.trendTotal}>{trend.total} records</Text>
            </View>
            <View style={styles.trendBreakdown}>
              <View style={styles.trendItem}>
                <View style={[styles.trendDot, { backgroundColor: POSITIVE_COLOR }]} />
                <Text style={styles.trendItemText}>Positive: {trend.positive}</Text>
              </View>
              <View style={styles.trendItem}>
                <View style={[styles.trendDot, { backgroundColor: NEGATIVE_COLOR }]} />
                <Text style={styles.trendItemText}>Negative: {trend.negative}</Text>
              </View>
              <View style={styles.trendItem}>
                <View style={[styles.trendDot, { backgroundColor: NEUTRAL_COLOR }]} />
                <Text style={styles.trendItemText}>Neutral: {trend.neutral}</Text>
              </View>
            </View>
          </View>
        ))}
      </Animated.View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading conduct data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !conductData) {
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
            onPress={fetchConductData}
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
        {renderTabSelector()}
        
        {selectedTab === 'records' && renderRecordsTab()}
        {selectedTab === 'overview' && renderOverviewTab()}
        {selectedTab === 'summary' && renderSummaryTab()}
        {selectedTab === 'trends' && renderTrendsTab()}
        
        {/* Date Range Info */}
        {conductData && (
          <View style={styles.dateRangeInfo}>
            <Text style={styles.dateRangeText}>
              Last updated: {new Date(conductData.lastUpdated).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#F8F9FC',
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  tabContainer: {
    marginBottom: 20,
  },
  tabScrollContent: {
    paddingVertical: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 30,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
  },
  // Overview Tab Styles
  mainStatsCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    fontWeight: '700',
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
    gap: 12,
    marginBottom: 20,
  },
  subStatsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  subStatsIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  subStatsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
    marginBottom: 4,
  },
  subStatsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8A94A6',
  },
  subStatsPercentage: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8A94A6',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 2,
  },
  chart: {
    marginTop: 12,
    borderRadius: 12,
  },
  // Records Tab Styles
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 20,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    borderColor: 'transparent',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A4276',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recordHeader: {
    marginBottom: 12,
  },
  recordTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    flex: 1,
    marginRight: 12,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recordDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  recordDate: {
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '500',
  },
  recordDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  recordMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  metaText: {
    fontSize: 13,
    color: '#8A94A6',
    fontWeight: '500',
  },
  recordFlags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  severityChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    gap: 4,
  },
  flagText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionTaken: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  actionText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  // Summary Tab Styles
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryGrid: {
    gap: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
  },
  breakdownContainer: {
    gap: 16,
  },
  breakdownItem: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  breakdownIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3A4276',
    flex: 1,
  },
  breakdownCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
    marginBottom: 4,
  },
  breakdownPercentage: {
    fontSize: 13,
    color: '#8A94A6',
    fontWeight: '500',
  },
  // Trends Tab Styles
  trendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendMonth: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
  },
  trendTotal: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  trendBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  trendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trendItemText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Common Styles
  dateRangeInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  dateRangeText: {
    fontSize: 13,
    color: '#8A94A6',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#8A94A6',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StudentConductScreen;