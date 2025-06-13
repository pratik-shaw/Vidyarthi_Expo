import React, { useEffect, useState, useCallback } from 'react';
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
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';

// Constants
const API_URL = 'http://192.168.29.148:5000/api';
const API_TIMEOUT = 15000;
const { width } = Dimensions.get('window');

// Types
type TeacherEventCalendarParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherEventCalendar'>;

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

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
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

const categoryColors: { [key: string]: string } = {
  exam: '#E74C3C',
  assignment: '#3498DB',
  project: '#9B59B6',
  meeting: '#F39C12',
  holiday: '#E67E22',
  sports: '#1ABC9C',
  cultural: '#2ECC71',
  other: '#95A5A6',
};

const TeacherEventCalendarScreen: React.FC<Props> = ({ route, navigation }) => {
  // Route params
  const { classId, className } = route.params as TeacherEventCalendarParams;
  
  // State management
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});
  const [isLoadingMonth, setIsLoadingMonth] = useState<boolean>(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  
  // Simple date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState<boolean>(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState<boolean>(false);
  
  // Form states
  const [formData, setFormData] = useState({
    title: '',
    category: 'other',
    startDate: new Date(),
    endDate: new Date(),
    description: '',
  });

  // Set navigation header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `${className} - Events`,
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2C3E50',
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
      },
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={styles.headerButton}
        >
          <Feather name="plus" size={24} color="#3498DB" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, className]);

  // Network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
      });
    });

    return () => unsubscribe();
  }, []);

  // Initialize component
  useEffect(() => {
    initializeScreen();
  }, [classId]);

  // Create authenticated API client
  const createApiClient = useCallback((authToken: string) => {
    return axios.create({
      baseURL: API_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-auth-token': authToken,
        'Content-Type': 'application/json',
      },
    });
  }, []);

  const initializeScreen = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('teacherToken');
      
      if (!storedToken) {
        handleSessionExpired();
        return;
      }
      
      setToken(storedToken);
      await Promise.all([
        fetchEventCategories(storedToken),
        fetchEvents(storedToken, currentMonth, currentYear),
      ]);
    } catch (error) {
      console.error('Error initializing screen:', error);
      setError('Failed to initialize screen');
      setLoading(false);
    }
  };

  // Fetch event categories
  const fetchEventCategories = async (authToken: string = token!) => {
    try {
      const apiClient = createApiClient(authToken);
      const response = await apiClient.get('/events/categories');
      
      if (response.data && response.data.categories) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fixed fetch events function with proper month handling
  const fetchEvents = async (authToken: string = token!, month: number = currentMonth, year: number = currentYear) => {
    if (!authToken) {
      handleSessionExpired();
      return;
    }

    if (!networkState.isConnected) {
      setError('No internet connection. Please check your network and try again.');
      setLoading(false);
      setRefreshing(false);
      setIsLoadingMonth(false);
      return;
    }

    try {
      // Only show main loading for initial load, not for month changes
      if (!refreshing && !isLoadingMonth) {
        setLoading(true);
      }
      setError(null);

      const apiClient = createApiClient(authToken);
      const response = await apiClient.get(`/events/class/${classId}`, {
        params: {
          month: month,
          year: year,
        },
      });
      
      if (response.data) {
        const eventsList = response.data.events || [];
        setEvents(eventsList);
        updateMarkedDates(eventsList);
        console.log('Events loaded for', `${month}/${year}:`, eventsList.length);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      handleApiError(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsLoadingMonth(false);
    }
  };

  // Fixed month change handler
  const handleMonthChange = useCallback((month: { month: number; year: number }) => {
  console.log('Month changed to:', month.month, month.year);
  
  // Update state immediately
  setCurrentMonth(month.month);
  setCurrentYear(month.year);
  setIsLoadingMonth(true);
  
  // Fetch events for the new month
  if (token) {
    fetchEvents(token, month.month, month.year);
  }
}, [token]);

  // Update marked dates for calendar - FIXED
  const updateMarkedDates = (eventList: Event[]) => {
  const marked: MarkedDates = {};
  
  eventList.forEach(event => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const categoryColor = categoryColors[event.category] || categoryColors.other;
    
    // Mark single day or range
    if (startDate.toDateString() === endDate.toDateString()) {
      // Single day event
      const dateStr = startDate.toISOString().split('T')[0];
      marked[dateStr] = {
        selected: true,
        selectedColor: categoryColor,
      };
    } else {
      // Multi-day event
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

   if (!marked[selectedDate]) {
    marked[selectedDate] = {
      selected: true,
      selectedColor: '#3498DB',
    };
  }
  
  setMarkedDates(marked);
};

  // Fixed date picker handlers to prevent date offset issues
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }
    
    if (selectedDate && event.type !== 'dismissed') {
      // Create new date without timezone offset issues
      const localDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      
      setFormData(prev => ({
        ...prev,
        startDate: localDate,
        // Auto-adjust end date if it's before start date
        endDate: prev.endDate < localDate ? localDate : prev.endDate,
      }));
      
      if (Platform.OS === 'ios') {
        setShowStartDatePicker(false);
      }
    } else if (event.type === 'dismissed' && Platform.OS === 'ios') {
      setShowStartDatePicker(false);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
    
    if (selectedDate && event.type !== 'dismissed') {
      // Create new date without timezone offset issues
      const localDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      
      if (localDate >= formData.startDate) {
        setFormData(prev => ({
          ...prev,
          endDate: localDate,
        }));
        
        if (Platform.OS === 'ios') {
          setShowEndDatePicker(false);
        }
      } else {
        Alert.alert('Invalid Date', 'End date must be after or equal to start date');
        if (Platform.OS === 'ios') {
          setShowEndDatePicker(false);
        }
      }
    } else if (event.type === 'dismissed' && Platform.OS === 'ios') {
      setShowEndDatePicker(false);
    }
  };

  // Create new event with fixed date formatting
  const handleCreateEvent = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter event title');
      return;
    }

    if (formData.endDate < formData.startDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    try {
      setModalLoading(true);
      const apiClient = createApiClient(token!);
      
      // Format dates properly to avoid timezone issues
      const formatDateForAPI = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      };
      
      const response = await apiClient.post('/events/create', {
        classId,
        title: formData.title.trim(),
        category: formData.category,
        startDate: formatDateForAPI(formData.startDate),
        endDate: formatDateForAPI(formData.endDate),
        description: formData.description.trim(),
      });

      if (response.data) {
        Alert.alert('Success', 'Event created successfully');
        setShowCreateModal(false);
        resetForm();
        // Refresh events for current month
        fetchEvents(token!, currentMonth, currentYear);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      const message = axios.isAxiosError(error) && error.response?.data?.msg 
        ? error.response.data.msg 
        : 'Failed to create event';
      Alert.alert('Error', message);
    } finally {
      setModalLoading(false);
    }
  };

  // Delete event
  const handleDeleteEvent = async (event: Event) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const apiClient = createApiClient(token!);
              await apiClient.delete(`/events/class/${classId}/event/${event.eventId}`);
              
              Alert.alert('Success', 'Event deleted successfully');
              setShowEventDetailsModal(false);
              fetchEvents(token!, currentMonth, currentYear);
            } catch (error) {
              console.error('Error deleting event:', error);
              const message = axios.isAxiosError(error) && error.response?.data?.msg 
                ? error.response.data.msg 
                : 'Failed to delete event';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    const today = new Date();
    setFormData({
      title: '',
      category: 'other',
      startDate: today,
      endDate: today,
      description: '',
    });
  };

  const handleApiError = (error: any) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        handleSessionExpired();
      } else if (error.response?.status === 404) {
        setError('Class not found. Please check if the class still exists.');
      } else if (error.code === 'ECONNABORTED') {
        setError('Request timeout. Please try again.');
      } else {
        const message = error.response?.data?.msg || error.response?.data?.message || 'Failed to load events';
        setError(message);
      }
    } else {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleSessionExpired = () => {
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please login again.',
      [
        {
          text: 'OK',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('teacherToken');
              navigation.reset({
                index: 0,
                routes: [{ name: 'TeacherLogin' }],
              });
            } catch (error) {
              console.error('Error clearing storage:', error);
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents(token!, currentMonth, currentYear);
  }, [token, currentMonth, currentYear]);

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
    const icons: { [key: string]: keyof typeof Feather.glyphMap } = {
      exam: 'file-text',
      assignment: 'edit',
      project: 'folder',
      meeting: 'users',
      holiday: 'sun',
      sports: 'activity',
      cultural: 'music',
      other: 'calendar',
    };
    return icons[category] || 'calendar';
  };

  // Render event item
  const renderEventItem = ({ item }: { item: Event }) => {
    const categoryColor = categoryColors[item.category] || categoryColors.other;
    const isMultiDay = new Date(item.startDate).toDateString() !== new Date(item.endDate).toDateString();
    
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => {
          setSelectedEvent(item);
          setShowEventDetailsModal(true);
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
              <Feather name={getCategoryIcon(item.category)} size={12} color="#FFFFFF" />
              <Text style={styles.categoryText}>
                {categories.find(c => c.value === item.category)?.label || item.category}
              </Text>
            </View>
          </View>
          
          <View style={styles.eventDetails}>
            <View style={styles.dateContainer}>
              <Feather name="calendar" size={14} color="#7F8C8D" />
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

  // Render create event modal
  const renderCreateEventModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowCreateModal(false)}
            style={styles.modalCloseButton}
          >
            <Feather name="x" size={24} color="#7F8C8D" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Create Event</Text>
          <TouchableOpacity
            onPress={handleCreateEvent}
            style={[styles.modalSaveButton, { opacity: modalLoading ? 0.6 : 1 }]}
            disabled={modalLoading}
          >
            {modalLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.modalSaveText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Event Title */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Event Title *</Text>
            <TextInput
              style={styles.formInput}
              value={formData.title}
              onChangeText={(text) => setFormData({ ...formData, title: text })}
              placeholder="Enter event title"
              placeholderTextColor="#BDC3C7"
            />
          </View>

          {/* Category Selection */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: formData.category === category.value 
                        ? categoryColors[category.value] 
                        : '#F8F9FC',
                      borderColor: formData.category === category.value 
                        ? categoryColors[category.value] 
                        : '#E8E8E8',
                    },
                  ]}
                  onPress={() => setFormData({ ...formData, category: category.value })}
                >
                  <Feather
                    name={getCategoryIcon(category.value)}
                    size={16}
                    color={formData.category === category.value ? '#FFFFFF' : '#7F8C8D'}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      {
                        color: formData.category === category.value ? '#FFFFFF' : '#7F8C8D',
                      },
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Date Selection */}
          <View style={styles.dateRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Start Date *</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowStartDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateInputText}>{formatDate(formData.startDate)}</Text>
                <Feather name="calendar" size={20} color="#7F8C8D" />
              </TouchableOpacity>
            </View>

            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>End Date *</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowEndDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateInputText}>{formatDate(formData.endDate)}</Text>
                <Feather name="calendar" size={20} color="#7F8C8D" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Enter event description (optional)"
              placeholderTextColor="#BDC3C7"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        {/* Native Date Pickers */}
        {showStartDatePicker && (
          <Modal
            visible={showStartDatePicker}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowStartDatePicker(false)}
          >
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity
                    onPress={() => setShowStartDatePicker(false)}
                    style={styles.datePickerButton}
                  >
                    <Text style={styles.datePickerButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select Start Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowStartDatePicker(false)}
                    style={styles.datePickerButton}
                  >
                    <Text style={[styles.datePickerButtonText, styles.datePickerConfirmText]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={formData.startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleStartDateChange}
                  minimumDate={new Date()}
                  style={styles.datePickerStyle}
                  textColor="#2C3E50"
                />
              </View>
            </View>
          </Modal>
        )}

        {showEndDatePicker && (
          <Modal
            visible={showEndDatePicker}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowEndDatePicker(false)}
          >
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity
                    onPress={() => setShowEndDatePicker(false)}
                    style={styles.datePickerButton}
                  >
                    <Text style={styles.datePickerButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select End Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowEndDatePicker(false)}
                    style={styles.datePickerButton}
                  >
                    <Text style={[styles.datePickerButtonText, styles.datePickerConfirmText]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={formData.endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleEndDateChange}
                  minimumDate={formData.startDate}
                  style={styles.datePickerStyle}
                  textColor="#2C3E50"
                />
              </View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );

  // Render event details modal
  const renderEventDetailsModal = () => (
    <Modal
      visible={showEventDetailsModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowEventDetailsModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowEventDetailsModal(false)}
            style={styles.modalCloseButton}
          >
            <Feather name="x" size={24} color="#7F8C8D" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Event Details</Text>
          <TouchableOpacity
            onPress={() => selectedEvent && handleDeleteEvent(selectedEvent)}
            style={styles.deleteButton}
          >
            <Feather name="trash-2" size={20} color="#E74C3C" />
          </TouchableOpacity>
        </View>

        {selectedEvent && (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.eventDetailsContainer}>
              <View style={styles.eventDetailsHeader}>
                <View style={[
                  styles.eventDetailsBadge,
                  { backgroundColor: categoryColors[selectedEvent.category] || categoryColors.other }
                ]}>
                  <Feather
                    name={getCategoryIcon(selectedEvent.category)}
                    size={20}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.eventDetailsInfo}>
                  <Text style={styles.eventDetailsTitle}>{selectedEvent.title}</Text>
                  <Text style={styles.eventDetailsCategory}>
                    {categories.find(c => c.value === selectedEvent.category)?.label || selectedEvent.category}
                  </Text>
                </View>
              </View>

              <View style={styles.eventDetailsSection}>
                <Text style={styles.eventDetailsSectionTitle}>Date & Time</Text>
                <View style={styles.eventDetailsRow}>
                  <Feather name="calendar" size={16} color="#7F8C8D" />
                  <Text style={styles.eventDetailsText}>
                    {new Date(selectedEvent.startDate).toDateString() === new Date(selectedEvent.endDate).toDateString()
                      ? formatDate(selectedEvent.startDate)
                      : `${formatDate(selectedEvent.startDate)} - ${formatDate(selectedEvent.endDate)}`
                    }
                  </Text>
                </View>
              </View>

              {selectedEvent.description && (
                <View style={styles.eventDetailsSection}>
                  <Text style={styles.eventDetailsSectionTitle}>Description</Text>
                  <Text style={styles.eventDetailsDescription}>{selectedEvent.description}</Text>
                </View>
              )}

              <View style={styles.eventDetailsSection}>
                <Text style={styles.eventDetailsSectionTitle}>Created By</Text>
                <View style={styles.eventDetailsRow}>
                  <Feather name="user" size={16} color="#7F8C8D" />
                  <Text style={styles.eventDetailsText}>{selectedEvent.createdBy.name}</Text>
                </View>
                <View style={styles.eventDetailsRow}>
                  <Feather name="mail" size={16} color="#7F8C8D" />
                  <Text style={styles.eventDetailsText}>{selectedEvent.createdBy.email}</Text>
                </View>
              </View>

              <View style={styles.eventDetailsSection}>
                <Text style={styles.eventDetailsSectionTitle}>Created On</Text>
                <Text style={styles.eventDetailsText}>
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
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498DB" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && events.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContainer}>
          <FontAwesome5 name="exclamation-triangle" size={48} color="#E74C3C" />
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchEvents()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3498DB', '#2ECC71']}
            tintColor="#3498DB"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar */}
        <View style={styles.calendarContainer}>
         <Calendar
  onDayPress={(day) => {
    setSelectedDate(day.dateString);
  }}
  onMonthChange={handleMonthChange}
  markedDates={markedDates}
  current={`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`}
  theme={{
    backgroundColor: '#FFFFFF',
    calendarBackground: '#FFFFFF',
    textSectionTitleColor: '#2C3E50',
    selectedDayBackgroundColor: '#3498DB',
    selectedDayTextColor: '#FFFFFF',
    todayTextColor: '#3498DB',
    dayTextColor: '#2C3E50',
    textDisabledColor: '#BDC3C7',
    arrowColor: '#3498DB',
    monthTextColor: '#2C3E50',
    indicatorColor: '#3498DB',
    textDayFontFamily: 'System',
    textMonthFontFamily: 'System',
    textDayHeaderFontFamily: 'System',
    textDayFontWeight: '400',
    textMonthFontWeight: '600',
    textDayHeaderFontWeight: '600',
    textDayFontSize: 16,
    textMonthFontSize: 18,
    textDayHeaderFontSize: 14,
    // Remove dot-related properties
  }}
/>
        </View>

        {/* Events List */}
        <View style={styles.eventsSection}>
          <View style={styles.eventsSectionHeader}>
            <Text style={styles.eventsSectionTitle}>
              Events - {new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <Text style={styles.eventsCount}>{events.length} events</Text>
          </View>

          {events.length > 0 ? (
            <FlatList
              data={events}
              renderItem={renderEventItem}
              keyExtractor={(item) => item.eventId}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
              contentContainerStyle={styles.eventsList}
            />
          ) : (
            <View style={styles.emptyEventsContainer}>
              <Feather name="calendar" size={48} color="#BDC3C7" />
              <Text style={styles.emptyEventsTitle}>No Events This Month</Text>
              <Text style={styles.emptyEventsMessage}>
                There are no events scheduled for this month. Tap the + button to create your first event.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      {renderCreateEventModal()}
      {renderEventDetailsModal()}

      {/* Network Status */}
      {!networkState.isConnected && (
        <View style={styles.networkStatusBar}>
          <Feather name="wifi-off" size={16} color="#FFFFFF" />
          <Text style={styles.networkStatusText}>No Internet Connection</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#F8F9FC',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  datePickerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  datePickerConfirmText: {
    color: '#3498DB',
    fontWeight: '600',
  },
  datePickerStyle: {
    backgroundColor: '#FFFFFF',
    marginVertical: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  scrollView: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
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
  eventsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
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
    color: '#2C3E50',
  },
  eventsCount: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  eventsList: {
    paddingBottom: 20,
  },
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
    color: '#2C3E50',
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
    color: '#7F8C8D',
    marginLeft: 6,
    fontWeight: '500',
  },
  eventDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    lineHeight: 20,
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
    color: '#2C3E50',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyEventsMessage: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 22,
  },
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
    color: '#2C3E50',
  },
  modalSaveButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dateInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  eventDetailsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  eventDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  eventDetailsBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  eventDetailsInfo: {
    flex: 1,
  },
  eventDetailsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  eventDetailsCategory: {
    fontSize: 16,
    color: '#7F8C8D',
    textTransform: 'capitalize',
  },
  eventDetailsSection: {
    marginBottom: 20,
  },
  eventDetailsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F8C8D',
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
    color: '#2C3E50',
    marginLeft: 12,
    flex: 1,
  },
  eventDetailsDescription: {
    fontSize: 16,
    color: '#2C3E50',
    lineHeight: 22,
  },
  networkStatusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#E74C3C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  networkStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default TeacherEventCalendarScreen;