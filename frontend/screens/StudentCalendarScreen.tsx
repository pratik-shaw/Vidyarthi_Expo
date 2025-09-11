// StudentCalendarScreen.tsx
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
  Alert,
  Modal,
  FlatList
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Calendar } from 'react-native-calendars';
import { STUDENT_API } from '../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RootStackParamList } from '../App';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#4F46E5';
const SECONDARY_COLOR = '#E0E7FF';

// API configuration
const API_URL = STUDENT_API; // Replace with your actual API URL
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

interface Event {
  eventId: string;
  title: string;
  category: string;
  startDate: string;
  endDate: string;
  description?: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface EventCategory {
  value: string;
  label: string;
}

interface MarkedDates {
  [key: string]: {
    selected?: boolean;
    marked?: boolean;
    selectedColor?: string;
    dotColor?: string;
    customStyles?: any;
  };
}

interface StudentInfo {
  classId: string;
  className: string;
  section: string;
}

interface CalendarData {
  studentInfo: StudentInfo;
  hasData: boolean;
  events: Event[];
  categories: EventCategory[];
  currentMonth: number;
  currentYear: number;
  totalEvents: number;
  upcomingEvents: number;
  lastUpdated: string;
  message?: string;
}

const categoryColors: { [key: string]: string } = {
  exam: '#EF4444',
  assignment: '#3B82F6',
  project: '#8B5CF6',
  meeting: '#F59E0B',
  holiday: '#F97316',
  sports: '#10B981',
  cultural: '#06B6D4',
  other: '#6B7280',
};

const StudentCalendarScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Set header options to hide the default header
    navigation.setOptions({
      headerShown: false,
    });

    fetchCalendarData();
    startAnimations();
  }, [navigation]);

  useEffect(() => {
    if (calendarData) {
      fetchEventsForMonth(currentMonth, currentYear);
    }
  }, [currentMonth, currentYear]);

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

  const fetchCalendarData = async () => {
    try {
      setError(null);
      const response = await apiClient.get('/api/events/student/calendar-data');
      setCalendarData(response.data);
      
      if (response.data.events) {
        updateMarkedDates(response.data.events);
      }
    } catch (err: any) {
      console.error('Error fetching calendar data:', err);
      if (err.response?.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: () => navigation.replace('StudentLogin') }
        ]);
      } else {
        setError(err.response?.data?.msg || 'Failed to load calendar data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEventsForMonth = async (month: number, year: number) => {
    if (!calendarData?.studentInfo?.classId) return;

    try {
      const response = await apiClient.get(`/api/events/class/${calendarData.studentInfo.classId}`, {
        params: { month, year }
      });
      
      if (response.data?.events) {
        setCalendarData(prev => prev ? {
          ...prev,
          events: response.data.events,
          currentMonth: month,
          currentYear: year
        } : null);
        updateMarkedDates(response.data.events);
      }
    } catch (err: any) {
      console.error('Error fetching month events:', err);
      if (err.response?.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: () => navigation.replace('StudentLogin') }
        ]);
      }
    }
  };

  const updateMarkedDates = (eventList: Event[]) => {
    const marked: MarkedDates = {};
    
    eventList.forEach(event => {
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      const categoryColor = categoryColors[event.category] || categoryColors.other;
      
      if (startDate.toDateString() === endDate.toDateString()) {
        const dateStr = startDate.toISOString().split('T')[0];
        marked[dateStr] = {
          selected: true,
          selectedColor: categoryColor,
        };
      } else {
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          marked[dateStr] = {
            selected: true,
            selectedColor: categoryColor,
          };
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });

    setMarkedDates(marked);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCalendarData();
    setRefreshing(false);
  };

  const handleMonthChange = (month: { month: number; year: number }) => {
    setCurrentMonth(month.month);
    setCurrentYear(month.year);
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
    const icons: { [key: string]: keyof typeof Ionicons.glyphMap } = {
      exam: 'document-text-outline',
      assignment: 'create-outline',
      project: 'folder-outline',
      meeting: 'people-outline',
      holiday: 'sunny-outline',
      sports: 'fitness-outline',
      cultural: 'musical-notes-outline',
      other: 'calendar-outline',
    };
    return icons[category] || 'calendar-outline';
  };

  const getEventsForSelectedDate = () => {
    if (!calendarData?.events || !selectedDate) return [];
    
    return calendarData.events.filter(event => {
      const startDate = new Date(event.startDate).toISOString().split('T')[0];
      const endDate = new Date(event.endDate).toISOString().split('T')[0];
      return selectedDate >= startDate && selectedDate <= endDate;
    });
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
      
      <Text style={styles.headerTitle}>Class Calendar</Text>
      
      <View style={styles.headerSpacer} />
    </Animated.View>
  );

  const renderStatsOverview = () => {
    if (!calendarData?.hasData) return null;

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
        <View style={styles.subStatsContainer}>
          <View style={styles.subStatsCard}>
            <View style={[styles.subStatsIcon, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="calendar-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.subStatsValue}>{calendarData.totalEvents}</Text>
            <Text style={styles.subStatsLabel}>Total Events</Text>
          </View>
          
          <View style={styles.subStatsCard}>
            <View style={[styles.subStatsIcon, { backgroundColor: '#3B82F615' }]}>
              <Ionicons name="time-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.subStatsValue}>{calendarData.upcomingEvents}</Text>
            <Text style={styles.subStatsLabel}>Upcoming</Text>
          </View>
          
          <View style={styles.subStatsCard}>
            <View style={[styles.subStatsIcon, { backgroundColor: '#F59E0B15' }]}>
              <Ionicons name="school-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.subStatsValue}>{calendarData.studentInfo.className}</Text>
            <Text style={styles.subStatsLabel}>Class</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderEventItem = ({ item }: { item: Event }) => {
    const categoryColor = categoryColors[item.category] || categoryColors.other;
    const isMultiDay = new Date(item.startDate).toDateString() !== new Date(item.endDate).toDateString();
    
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => {
          setSelectedEvent(item);
          setShowEventModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <View style={[styles.eventIcon, { backgroundColor: `${categoryColor}15` }]}>
              <Ionicons name={getCategoryIcon(item.category)} size={16} color={categoryColor} />
            </View>
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.eventMeta}>
                <Text style={styles.eventDate}>
                  {isMultiDay 
                    ? `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`
                    : formatDate(item.startDate)
                  }
                </Text>
                <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
                  <Text style={styles.categoryText}>
                    {calendarData?.categories.find(c => c.value === item.category)?.label || item.category}
                  </Text>
                </View>
              </View>
              
              {item.description && (
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEventModal = () => (
    <Modal
      visible={showEventModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowEventModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowEventModal(false)}
            style={styles.modalCloseButton}
          >
            <Feather name="x" size={24} color="#3A4276" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Event Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        {selectedEvent && (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.eventDetailsContainer}>
              <LinearGradient
                colors={[categoryColors[selectedEvent.category] || categoryColors.other, '#6366F1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.eventDetailsBanner}
              >
                <View style={styles.eventDetailsBadge}>
                  <Ionicons
                    name={getCategoryIcon(selectedEvent.category)}
                    size={24}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.eventDetailsTitle}>{selectedEvent.title}</Text>
                <Text style={styles.eventDetailsCategory}>
                  {calendarData?.categories.find(c => c.value === selectedEvent.category)?.label || selectedEvent.category}
                </Text>
              </LinearGradient>

              <View style={styles.eventDetailsBody}>
                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIcon, { backgroundColor: `${PRIMARY_COLOR}15` }]}>
                      <Ionicons name="calendar-outline" size={20} color={PRIMARY_COLOR} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedEvent.startDate).toDateString() === new Date(selectedEvent.endDate).toDateString()
                          ? formatDate(selectedEvent.startDate)
                          : `${formatDate(selectedEvent.startDate)} - ${formatDate(selectedEvent.endDate)}`
                        }
                      </Text>
                    </View>
                  </View>
                </View>

                {selectedEvent.description && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <View style={[styles.detailIcon, { backgroundColor: `${PRIMARY_COLOR}15` }]}>
                        <Ionicons name="document-text-outline" size={20} color={PRIMARY_COLOR} />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Description</Text>
                        <Text style={styles.detailValue}>{selectedEvent.description}</Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIcon, { backgroundColor: `${PRIMARY_COLOR}15` }]}>
                      <Ionicons name="person-outline" size={20} color={PRIMARY_COLOR} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Created By</Text>
                      <Text style={styles.detailValue}>{selectedEvent.createdBy.name}</Text>
                      <Text style={styles.detailSubValue}>{selectedEvent.createdBy.email}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIcon, { backgroundColor: `${PRIMARY_COLOR}15` }]}>
                      <Ionicons name="time-outline" size={20} color={PRIMARY_COLOR} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Created On</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedEvent.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={60} color="#8A94A6" />
          <Text style={styles.errorTitle}>Unable to Load Calendar</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchCalendarData}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const selectedDateEvents = getEventsForSelectedDate();

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
        {!calendarData?.hasData ? (
          <Animated.View
            style={[
              styles.noDataContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Ionicons name="calendar-outline" size={60} color="#8A94A6" />
            <Text style={styles.noDataTitle}>No Events Available</Text>
            <Text style={styles.noDataText}>
              {calendarData?.message || 'Your class events will appear here once they are created.'}
            </Text>
          </Animated.View>
        ) : (
          <>
            {renderStatsOverview()}

            {/* Calendar */}
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <View style={styles.calendarCard}>
                <Calendar
                  onDayPress={(day) => setSelectedDate(day.dateString)}
                  onMonthChange={handleMonthChange}
                  markedDates={markedDates}
                  current={`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`}
                  theme={{
                    backgroundColor: '#FFFFFF',
                    calendarBackground: '#FFFFFF',
                    textSectionTitleColor: '#3A4276',
                    selectedDayBackgroundColor: PRIMARY_COLOR,
                    selectedDayTextColor: '#FFFFFF',
                    todayTextColor: PRIMARY_COLOR,
                    dayTextColor: '#3A4276',
                    textDisabledColor: '#8A94A6',
                    arrowColor: PRIMARY_COLOR,
                    monthTextColor: '#3A4276',
                    indicatorColor: PRIMARY_COLOR,
                    textDayFontFamily: 'System',
                    textMonthFontFamily: 'System',
                    textDayHeaderFontFamily: 'System',
                    textDayFontWeight: '500',
                    textMonthFontWeight: '700',
                    textDayHeaderFontWeight: '600',
                    textDayFontSize: 16,
                    textMonthFontSize: 18,
                    textDayHeaderFontSize: 14,
                  }}
                />
              </View>
            </Animated.View>

            {/* Selected Date Events */}
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <Text style={styles.sectionTitle}>
                Events for {new Date(selectedDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
              
              {selectedDateEvents.length > 0 ? (
                <FlatList
                  data={selectedDateEvents}
                  renderItem={renderEventItem}
                  keyExtractor={(item) => item.eventId}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.noEventsContainer}>
                  <Ionicons name="calendar-outline" size={32} color="#8A94A6" />
                  <Text style={styles.noEventsText}>No events on this date</Text>
                </View>
              )}
            </Animated.View>

            {/* All Events This Month */}
            {calendarData.events.length > 0 && (
              <Animated.View
                style={[
                  styles.section,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <Text style={styles.sectionTitle}>
                  All Events - {new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </Text>
                
                <FlatList
                  data={calendarData.events}
                  renderItem={renderEventItem}
                  keyExtractor={(item) => item.eventId}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={false}
                />
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      {renderEventModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },

  // Header Styles (consistent with attendance screen)
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

  // Content Container
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Stats Container (consistent with attendance screen)
  statsContainer: {
    marginBottom: 30,
  },
  subStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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

  // Section Styles
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
    marginBottom: 16,
  },

  // Calendar Styles (updated for consistency)
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // Event Card Styles (updated for consistency)
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 13,
    color: '#8A94A6',
    fontWeight: '500',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  eventDescription: {
    fontSize: 13,
    color: '#8A94A6',
    lineHeight: 18,
  },

  // Loading States (consistent with attendance screen)
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
    fontWeight: '500',
  },

  // Error States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // No Data States
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 20,
  },

  // No Events for Selected Date
  noEventsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  noEventsText: {
    fontSize: 14,
    color: '#8A94A6',
    marginTop: 8,
    fontWeight: '500',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
    flex: 1,
    textAlign: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  // Event Details Modal
  eventDetailsContainer: {
    marginBottom: 24,
  },
  eventDetailsBanner: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  eventDetailsBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  eventDetailsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  eventDetailsCategory: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  eventDetailsBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // Detail Section Styles
  detailSection: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A94A6',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    lineHeight: 22,
  },
  detailSubValue: {
    fontSize: 14,
    color: '#8A94A6',
    marginTop: 2,
  },
});

export default StudentCalendarScreen;