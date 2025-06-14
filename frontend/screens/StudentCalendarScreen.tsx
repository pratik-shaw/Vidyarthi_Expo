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

import { RootStackParamList } from '../App';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#4F46E5';
const SECONDARY_COLOR = '#E0E7FF';

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

  useEffect(() => {
    fetchCalendarData();
    startAnimations();
  }, []);

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
        <View style={[styles.eventIndicator, { backgroundColor: categoryColor }]} />
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
              <Ionicons name={getCategoryIcon(item.category)} size={12} color="#FFFFFF" />
              <Text style={styles.categoryText}>
                {calendarData?.categories.find(c => c.value === item.category)?.label || item.category}
              </Text>
            </View>
          </View>
          
          <View style={styles.eventDetails}>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text style={styles.dateText}>
                {isMultiDay 
                  ? `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`
                  : formatDate(item.startDate)
                }
              </Text>
            </View>
            
            {item.description && (
              <Text style={styles.eventDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}
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
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Event Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        {selectedEvent && (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.eventDetailsContainer}>
              <LinearGradient
                colors={[categoryColors[selectedEvent.category] || categoryColors.other, '#6366F1']}
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
                    <Ionicons name="calendar-outline" size={20} color={PRIMARY_COLOR} />
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
                      <Ionicons name="document-text-outline" size={20} color={PRIMARY_COLOR} />
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Description</Text>
                        <Text style={styles.detailValue}>{selectedEvent.description}</Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={20} color={PRIMARY_COLOR} />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Created By</Text>
                      <Text style={styles.detailValue}>{selectedEvent.createdBy.name}</Text>
                      <Text style={styles.detailSubValue}>{selectedEvent.createdBy.email}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={20} color={PRIMARY_COLOR} />
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Error Loading Calendar</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchCalendarData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selectedDateEvents = getEventsForSelectedDate();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Class Calendar</Text>
        <View style={styles.headerRight} />
      </View>

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
          {!calendarData?.hasData ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="calendar-outline" size={64} color="#9CA3AF" />
              <Text style={styles.noDataTitle}>No Events Available</Text>
              <Text style={styles.noDataText}>
                {calendarData?.message || 'Your class events will appear here once they are created.'}
              </Text>
            </View>
          ) : (
            <>
              {/* Stats Overview */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: '#10B981' + '15' }]}>
                    <Ionicons name="calendar-outline" size={20} color="#10B981" />
                  </View>
                  <Text style={styles.statValue}>{calendarData.totalEvents}</Text>
                  <Text style={styles.statLabel}>Total Events</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: '#3B82F6' + '15' }]}>
                    <Ionicons name="time-outline" size={20} color="#3B82F6" />
                  </View>
                  <Text style={styles.statValue}>{calendarData.upcomingEvents}</Text>
                  <Text style={styles.statLabel}>Upcoming</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: '#F59E0B' + '15' }]}>
                    <Ionicons name="school-outline" size={20} color="#F59E0B" />
                  </View>
                  <Text style={styles.statValue}>{calendarData.studentInfo.className}</Text>
                  <Text style={styles.statLabel}>Class</Text>
                </View>
              </View>

              {/* Calendar */}
              <View style={styles.calendarCard}>
                <Calendar
                  onDayPress={(day) => setSelectedDate(day.dateString)}
                  onMonthChange={handleMonthChange}
                  markedDates={markedDates}
                  current={`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`}
                  theme={{
                    backgroundColor: '#FFFFFF',
                    calendarBackground: '#FFFFFF',
                    textSectionTitleColor: '#374151',
                    selectedDayBackgroundColor: PRIMARY_COLOR,
                    selectedDayTextColor: '#FFFFFF',
                    todayTextColor: PRIMARY_COLOR,
                    dayTextColor: '#374151',
                    textDisabledColor: '#9CA3AF',
                    arrowColor: PRIMARY_COLOR,
                    monthTextColor: '#374151',
                    indicatorColor: PRIMARY_COLOR,
                    textDayFontFamily: 'System',
                    textMonthFontFamily: 'System',
                    textDayHeaderFontFamily: 'System',
                    textDayFontWeight: '400',
                    textMonthFontWeight: '600',
                    textDayHeaderFontWeight: '600',
                    textDayFontSize: 16,
                    textMonthFontSize: 18,
                    textDayHeaderFontSize: 14,
                  }}
                />
              </View>

              {/* Selected Date Events */}
              <View style={styles.eventsSection}>
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
                    <Ionicons name="calendar-outline" size={32} color="#9CA3AF" />
                    <Text style={styles.noEventsText}>No events on this date</Text>
                  </View>
                )}
              </View>

              {/* All Events This Month */}
              {calendarData.events.length > 0 && (
                <View style={styles.eventsSection}>
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
                </View>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>

      {renderEventModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  headerRight: {
    width: 40, // Same width as back button to center the title
  },

  // Content Container
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },

  // Error States
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // No Data States
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Calendar Styles
  calendarCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  // Events Section
  eventsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },

  // Event Card Styles
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  eventIndicator: {
    width: 4,
    height: '100%',
  },
  eventContent: {
    flex: 1,
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    marginRight: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  eventDetails: {
    gap: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  eventDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },

  // No Events State
  noEventsContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  noEventsText: {
    fontSize: 14,
    color: '#9CA3AF',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  headerSpacer: {
    width: 40, // Same width as close button to center the title
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },

  // Event Details Modal
  eventDetailsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  eventDetailsBanner: {
    padding: 24,
    alignItems: 'center',
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
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  eventDetailsCategory: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  eventDetailsBody: {
    padding: 24,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailContent: {
    flex: 1,
    marginLeft: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    lineHeight: 22,
  },
  detailSubValue: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },

  // Network Status (if needed)
  networkStatusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  networkStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },

  // Legacy styles (keeping for backward compatibility)
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  eventsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  eventsCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  eventsList: {
    paddingBottom: 20,
  },
  emptyEventsContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyEventsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyEventsMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  eventDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  eventDetailsInfo: {
    flex: 1,
  },
  eventDetailsSection: {
    marginBottom: 20,
  },
  eventDetailsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  eventDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDetailsText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  eventDetailsDescription: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
});

export default StudentCalendarScreen;