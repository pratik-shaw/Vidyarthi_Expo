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

import { RootStackParamList } from '../App';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#4F46E5';
const POSITIVE_COLOR = '#10B981';
const NEGATIVE_COLOR = '#EF4444';
const NEUTRAL_COLOR = '#6B7280';

// API configuration
const API_URL = 'http://192.168.29.148:5000';
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
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
  
  const [conductData, setConductData] = useState<ConductData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'records' | 'trends' | 'summary'>('overview');
  const [selectedType, setSelectedType] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    fetchConductData();
    startAnimations();
  }, []);

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

  const fetchConductData = async () => {
    try {
      setError(null);
      const response = await apiClient.get('/api/conduct/student/my-conduct');
      setConductData(response.data);
    } catch (err: any) {
      console.error('Error fetching conduct data:', err);
      if (err.response?.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: () => navigation.replace('StudentLogin') }
        ]);
      } else {
        setError(err.response?.data?.msg || 'Failed to load conduct data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConductData();
    setRefreshing(false);
  };

  const getConductTypeColor = (type: string) => {
    switch (type) {
      case 'positive': return POSITIVE_COLOR;
      case 'negative': return NEGATIVE_COLOR;
      case 'neutral': return NEUTRAL_COLOR;
      default: return '#6B7280';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return '#10B981';
      case 'medium': return '#F59E0B';
      case 'high': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getFilteredRecords = () => {
    if (!conductData?.conducts) return [];
    if (selectedType === 'all') return conductData.conducts;
    return conductData.conducts.filter(record => record.type === selectedType);
  };

  const renderOverviewTab = () => {
    if (!conductData || !conductData.hasData) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="clipboard-outline" size={64} color="#9CA3AF" />
          <Text style={styles.noDataTitle}>No Conduct Records</Text>
          <Text style={styles.noDataText}>
            Your conduct records will appear here once they are created by your teachers.
          </Text>
        </View>
      );
    }

    const { summary } = conductData;

    return (
      <View style={styles.tabContent}>
        {/* Overall Conduct Card */}
        <LinearGradient
          colors={[PRIMARY_COLOR, '#6366F1']}
          style={styles.conductCard}
        >
          <View style={styles.conductHeader}>
            <Text style={styles.conductTitle}>Overall Conduct</Text>
            <View style={[styles.conductChip, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Text style={styles.conductChipText}>
                {summary.positiveCount > summary.negativeCount ? 'Good' : 
                 summary.negativeCount > summary.positiveCount ? 'Needs Improvement' : 'Average'}
              </Text>
            </View>
          </View>
          <Text style={styles.totalRecordsText}>{summary.totalRecords} Total Records</Text>
          <Text style={styles.conductSubtitle}>
            {summary.positiveCount} positive • {summary.negativeCount} negative • {summary.neutralCount} neutral
          </Text>
        </LinearGradient>

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: POSITIVE_COLOR + '15' }]}>
              <Ionicons name="thumbs-up-outline" size={20} color={POSITIVE_COLOR} />
            </View>
            <Text style={styles.statValue}>{summary.positiveCount}</Text>
            <Text style={styles.statLabel}>Positive</Text>
            <Text style={styles.statPercentage}>{summary.positivePercentage}%</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: NEGATIVE_COLOR + '15' }]}>
              <Ionicons name="thumbs-down-outline" size={20} color={NEGATIVE_COLOR} />
            </View>
            <Text style={styles.statValue}>{summary.negativeCount}</Text>
            <Text style={styles.statLabel}>Negative</Text>
            <Text style={styles.statPercentage}>{summary.negativePercentage}%</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: NEUTRAL_COLOR + '15' }]}>
              <Ionicons name="remove-outline" size={20} color={NEUTRAL_COLOR} />
            </View>
            <Text style={styles.statValue}>{summary.neutralCount}</Text>
            <Text style={styles.statLabel}>Neutral</Text>
            <Text style={styles.statPercentage}>{summary.neutralPercentage}%</Text>
          </View>
        </View>

        {/* Conduct Distribution Chart */}
        {summary.totalRecords > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Conduct Distribution</Text>
              <Text style={styles.chartSubtitle}>All time records</Text>
            </View>
            <PieChart
              data={[
                {
                  name: 'Positive',
                  population: summary.positiveCount,
                  color: POSITIVE_COLOR,
                  legendFontColor: '#374151',
                  legendFontSize: 12
                },
                {
                  name: 'Negative',
                  population: summary.negativeCount,
                  color: NEGATIVE_COLOR,
                  legendFontColor: '#374151',
                  legendFontSize: 12
                },
                {
                  name: 'Neutral',
                  population: summary.neutralCount,
                  color: NEUTRAL_COLOR,
                  legendFontColor: '#374151',
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
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Monthly Trends</Text>
              <Text style={styles.chartSubtitle}>Last 30 days</Text>
            </View>
            <LineChart
              data={{
                labels: summary.recentTrends.map(trend => trend.month.split('-')[1]),
                datasets: [
                  {
                    data: summary.recentTrends.map(trend => trend.positive),
                    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
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
                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
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
      </View>
    );
  };

  const renderRecordsTab = () => {
    const filteredRecords = getFilteredRecords();

    if (!conductData?.hasData || filteredRecords.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="document-outline" size={64} color="#9CA3AF" />
          <Text style={styles.noDataTitle}>No Records Found</Text>
          <Text style={styles.noDataText}>
            {selectedType === 'all' 
              ? 'No conduct records available.'
              : `No ${selectedType} conduct records found.`}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
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
              <View style={styles.recordInfo}>
                <View style={styles.recordTitleRow}>
                  <Text style={styles.recordTitle}>{record.title}</Text>
                  <View style={[
                    styles.typeChip,
                    { backgroundColor: getConductTypeColor(record.type) + '20' }
                  ]}>
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
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.recordDetails}>
              <View style={styles.recordMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="person-outline" size={16} color="#6B7280" />
                  <Text style={styles.metaText}>{record.teacherId.name}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="school-outline" size={16} color="#6B7280" />
                  <Text style={styles.metaText}>
                    {record.classId.name} - {record.classId.section}
                  </Text>
                </View>
              </View>

              <View style={styles.recordFlags}>
                <View style={[
                  styles.severityChip,
                  { backgroundColor: getSeverityColor(record.severity) + '20' }
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
                    <Ionicons name="mail-outline" size={12} color="#3B82F6" />
                    <Text style={styles.flagText}>Parent Notified</Text>
                  </View>
                )}
                {record.followUpRequired && (
                  <View style={styles.flagChip}>
                    <Ionicons name="time-outline" size={12} color="#F59E0B" />
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
      </View>
    );
  };

  const renderTrendsTab = () => {
    if (!conductData?.hasData || conductData.summary.recentTrends.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="trending-up-outline" size={64} color="#9CA3AF" />
          <Text style={styles.noDataTitle}>No Trend Data</Text>
          <Text style={styles.noDataText}>Trend analysis will be available once you have more conduct records.</Text>
        </View>
      );
    }

    const { summary } = conductData;

    return (
      <View style={styles.tabContent}>
        {/* Monthly Breakdown Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Monthly Breakdown</Text>
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
              labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
              style: { borderRadius: 16 }
            }}
            style={styles.chart}
            showValuesOnTopOfBars={true}
            yAxisLabel={''}
            yAxisSuffix={''}
            fromZero={true}
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
                <Text style={styles.trendLabel}>Positive: {trend.positive}</Text>
              </View>
              <View style={styles.trendItem}>
                <View style={[styles.trendDot, { backgroundColor: NEGATIVE_COLOR }]} />
                <Text style={styles.trendLabel}>Negative: {trend.negative}</Text>
              </View>
              <View style={styles.trendItem}>
                <View style={[styles.trendDot, { backgroundColor: NEUTRAL_COLOR }]} />
                <Text style={styles.trendLabel}>Neutral: {trend.neutral}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderSummaryTab = () => {
    if (!conductData?.hasData) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="bar-chart-outline" size={64} color="#9CA3AF" />
          <Text style={styles.noDataTitle}>No Summary Data</Text>
          <Text style={styles.noDataText}>Summary statistics will be available once you have conduct records.</Text>
        </View>
      );
    }

    const { summary, studentInfo } = conductData;

    return (
      <View style={styles.tabContent}>
        {/* Student Info Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Student Information</Text>
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
          <Text style={styles.summaryTitle}>Overall Statistics</Text>
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
          <Text style={styles.summaryTitle}>Conduct Breakdown</Text>
          <View style={styles.breakdownContainer}>
            <View style={styles.breakdownItem}>
              <View style={styles.breakdownHeader}>
                <View style={[styles.breakdownIcon, { backgroundColor: POSITIVE_COLOR + '15' }]}>
                  <Ionicons name="thumbs-up" size={20} color={POSITIVE_COLOR} />
                </View>
                <Text style={styles.breakdownTitle}>Positive Conduct</Text>
              </View>
              <Text style={styles.breakdownCount}>{summary.positiveCount} records</Text>
              <Text style={styles.breakdownPercentage}>{summary.positivePercentage}% of total</Text>
            </View>

            <View style={styles.breakdownItem}>
              <View style={styles.breakdownHeader}>
                <View style={[styles.breakdownIcon, { backgroundColor: NEGATIVE_COLOR + '15' }]}>
                  <Ionicons name="thumbs-down" size={20} color={NEGATIVE_COLOR} />
                </View>
                <Text style={styles.breakdownTitle}>Negative Conduct</Text>
              </View>
              <Text style={styles.breakdownCount}>{summary.negativeCount} records</Text>
              <Text style={styles.breakdownPercentage}>{summary.negativePercentage}% of total</Text>
            </View>

            <View style={styles.breakdownItem}>
              <View style={styles.breakdownHeader}>
                <View style={[styles.breakdownIcon, { backgroundColor: NEUTRAL_COLOR + '15' }]}>
                  <Ionicons name="remove" size={20} color={NEUTRAL_COLOR} />
                </View>
                <Text style={styles.breakdownTitle}>Neutral Records</Text>
              </View>
              <Text style={styles.breakdownCount}>{summary.neutralCount} records</Text>
              <Text style={styles.breakdownPercentage}>{summary.neutralPercentage}% of total</Text>
            </View>
          </View>
        </View>

        {/* Last Updated */}
        <View style={styles.lastUpdatedCard}>
          <Text style={styles.lastUpdatedText}>
            Last updated: {new Date(conductData.lastUpdated).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading conduct data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Error Loading Data</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchConductData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Conduct</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Tab Navigation */}
      <Animated.View style={[styles.tabContainer, { opacity: fadeAnim }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScrollView}>
          {[
            { key: 'overview', label: 'Overview', icon: 'analytics' },
            { key: 'records', label: 'Records', icon: 'list' },
            { key: 'trends', label: 'Trends', icon: 'trending-up' },
            { key: 'summary', label: 'Summary', icon: 'bar-chart' }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, selectedTab === tab.key && styles.tabButtonActive]}
              onPress={() => setSelectedTab(tab.key as any)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={18} 
                color={selectedTab === tab.key ? '#FFFFFF' : PRIMARY_COLOR} 
              />
              <Text style={[
                styles.tabButtonText, 
                selectedTab === tab.key && styles.tabButtonTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Content */}
      <Animated.View style={[
        styles.contentContainer, 
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        <ScrollView 
          style={styles.scrollView}
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
          {selectedTab === 'overview' && renderOverviewTab()}
          {selectedTab === 'records' && renderRecordsTab()}
          {selectedTab === 'trends' && renderTrendsTab()}
          {selectedTab === 'summary' && renderSummaryTab()}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  headerRight: {
    width: 40,
  },
  tabContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabScrollView: {
    paddingHorizontal: 20,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabButtonActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  tabButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: PRIMARY_COLOR,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  conductCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  conductHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conductTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  conductChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  conductChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  totalRecordsText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  conductSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  filterButtonActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordHeader: {
    marginBottom: 12,
  },
  recordInfo: {
    flex: 1,
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
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  typeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  recordDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  recordDate: {
    fontSize: 12,
    color: '#9CA3AF',
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
    flex: 1,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  recordFlags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  severityChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  flagText: {
    fontSize: 10,
    color: '#6B7280',
    marginLeft: 4,
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
    color: '#374151',
    marginBottom: 4,
  },
  actionText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  trendCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: '#111827',
  },
  trendTotal: {
    fontSize: 14,
    color: '#6B7280',
  },
  trendBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  trendLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  summaryGrid: {
    gap: 12,
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
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
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
  },
  breakdownIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  breakdownCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  breakdownPercentage: {
    fontSize: 14,
    color: '#6B7280',
  },
  lastUpdatedCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default StudentConductScreen;