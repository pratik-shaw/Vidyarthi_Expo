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
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  
  // Updated date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState<boolean>(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<Date>(new Date());
  const [tempEndDate, setTempEndDate] = useState<Date>(new Date());
  
  // Form states
  const [formData, setFormData] = useState({
    title: '',
    category: 'other',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
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

  // Update events when month/year changes
  useEffect(() => {
    if (token) {
      fetchEvents();
    }
  }, [currentMonth, currentYear, token]);

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
        fetchEvents(storedToken),
      ]);
    } catch (error) {
      console.error('Error initializing screen:', error);
      setError('Failed to initialize screen');
      setLoading(false);
    }
  };

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

  // Fetch events
  const fetchEvents = async (authToken: string = token!) => {
    if (!authToken) {
      handleSessionExpired();
      return;
    }

    if (!networkState.isConnected) {
      setError('No internet connection. Please check your network and try again.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(!refreshing);
      setError(null);

      const apiClient = createApiClient(authToken);
      const response = await apiClient.get(`/events/class/${classId}`, {
        params: {
          month: currentMonth,
          year: currentYear,
        },
      });
      
      if (response.data) {
        setEvents(response.data.events || []);
        updateMarkedDates(response.data.events || []);
        console.log('Events loaded:', response.data.events?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      handleApiError(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Update marked dates for calendar
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
          marked: true,
          dotColor: categoryColor,
          selected: dateStr === selectedDate,
          selectedColor: dateStr === selectedDate ? categoryColor : undefined,
        };
      } else {
        // Multi-day event
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          marked[dateStr] = {
            marked: true,
            dotColor: categoryColor,
            selected: dateStr === selectedDate,
            selectedColor: dateStr === selectedDate ? categoryColor : undefined,
          };
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });
    
    setMarkedDates(marked);
  };

  // Fixed date picker handlers
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
  setShowStartDatePicker(false);
  
  if (selectedDate && event.type !== 'dismissed') {
    const dateString = selectedDate.toISOString().split('T')[0];
    setFormData(prev => ({
      ...prev,
      startDate: dateString,
      // Auto-adjust end date if it's before start date
      endDate: new Date(prev.endDate) < selectedDate ? dateString : prev.endDate,
    }));
  }
};

const handleEndDateChange = (event: any, selectedDate?: Date) => {
  setShowEndDatePicker(false);
  
  if (selectedDate && event.type !== 'dismissed') {
    const startDate = new Date(formData.startDate);
    if (selectedDate >= startDate) {
      const dateString = selectedDate.toISOString().split('T')[0];
      setFormData(prev => ({
        ...prev,
        endDate: dateString,
      }));
    } else {
      Alert.alert('Invalid Date', 'End date must be after or equal to start date');
    }
  }
};


  // Fixed date picker trigger functions
  const showStartDatePickerModal = () => {
  if (Platform.OS === 'ios') {
    setTempStartDate(new Date(formData.startDate));
  }
  setShowStartDatePicker(true);
};

const showEndDatePickerModal = () => {
  if (Platform.OS === 'ios') {
    setTempEndDate(new Date(formData.endDate));
  }
  setShowEndDatePicker(true);
};

  // Create new event
  const handleCreateEvent = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter event title');
      return;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);

    if (endDate < startDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    try {
      setModalLoading(true);
      const apiClient = createApiClient(token!);
      
      const response = await apiClient.post('/events/create', {
        classId,
        title: formData.title.trim(),
        category: formData.category,
        startDate: formData.startDate,
        endDate: formData.endDate,
        description: formData.description.trim(),
      });

      if (response.data) {
        Alert.alert('Success', 'Event created successfully');
        setShowCreateModal(false);
        resetForm();
        fetchEvents();
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
              fetchEvents();
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
    setFormData({
      title: '',
      category: 'other',
      startDate: selectedDate,
      endDate: selectedDate,
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
    fetchEvents();
  }, [token, currentMonth, currentYear]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Fixed getCategoryIcon function with valid Feather icon names
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

  // Fixed date picker rendering function
  const renderDatePickers = () => {
  if (Platform.OS === 'ios') {
    return (
      <>
        {/* iOS Start Date Picker Modal */}
        <Modal
          visible={showStartDatePicker}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowStartDatePicker(false)}
        >
          <SafeAreaView style={styles.datePickerModalContainer}>
            <View style={styles.datePickerHeader}>
              <TouchableOpacity
                onPress={() => setShowStartDatePicker(false)}
                style={styles.datePickerButton}
              >
                <Text style={styles.datePickerButtonText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.datePickerTitle}>Select Start Date</Text>
              <TouchableOpacity
                onPress={() => {
                  const dateString = tempStartDate.toISOString().split('T')[0];
                  setFormData(prev => ({
                    ...prev,
                    startDate: dateString,
                    endDate: new Date(prev.endDate) < tempStartDate ? dateString : prev.endDate,
                  }));
                  setShowStartDatePicker(false);
                }}
                style={[styles.datePickerButton, { backgroundColor: '#3498DB' }]}
              >
                <Text style={[styles.datePickerButtonText, { color: '#FFFFFF' }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerContent}>
              <DateTimePicker
                value={tempStartDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date && event.type !== 'dismissed') {
                    setTempStartDate(date);
                  }
                }}
                minimumDate={new Date()}
                style={styles.datePicker}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {/* iOS End Date Picker Modal */}
        <Modal
          visible={showEndDatePicker}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowEndDatePicker(false)}
        >
          <SafeAreaView style={styles.datePickerModalContainer}>
            <View style={styles.datePickerHeader}>
              <TouchableOpacity
                onPress={() => setShowEndDatePicker(false)}
                style={styles.datePickerButton}
              >
                <Text style={styles.datePickerButtonText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.datePickerTitle}>Select End Date</Text>
              <TouchableOpacity
                onPress={() => {
                  const startDate = new Date(formData.startDate);
                  if (tempEndDate >= startDate) {
                    const dateString = tempEndDate.toISOString().split('T')[0];
                    setFormData(prev => ({
                      ...prev,
                      endDate: dateString,
                    }));
                    setShowEndDatePicker(false);
                  } else {
                    Alert.alert('Invalid Date', 'End date must be after or equal to start date');
                  }
                }}
                style={[styles.datePickerButton, { backgroundColor: '#3498DB' }]}
              >
                <Text style={[styles.datePickerButtonText, { color: '#FFFFFF' }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.datePickerContent}>
              <DateTimePicker
                value={tempEndDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date && event.type !== 'dismissed') {
                    setTempEndDate(date);
                  }
                }}
                minimumDate={new Date(formData.startDate)}
                style={styles.datePicker}
              />
            </View>
          </SafeAreaView>
        </Modal>
      </>
    );
  } else {
    // Android Date Pickers
    return (
      <>
        {showStartDatePicker && (
          <DateTimePicker
            value={new Date(formData.startDate)}
            mode="date"
            display="default"
            onChange={handleStartDateChange}
            minimumDate={new Date()}
          />
        )}
        {showEndDatePicker && (
          <DateTimePicker
            value={new Date(formData.endDate)}
            mode="date"
            display="default"
            onChange={handleEndDateChange}
            minimumDate={new Date(formData.startDate)}
          />
        )}
      </>
    );
  }
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
        activeOpacity={0.8}
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

          {/* Fixed date input section */}
          <View style={styles.dateRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>Start Date *</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={showStartDatePickerModal}
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
                onPress={showEndDatePickerModal}
                activeOpacity={0.7}
              >
                <Text style={styles.dateInputText}>{formatDate(formData.endDate)}</Text>
                <Feather name="calendar" size={20} color="#7F8C8D" />
              </TouchableOpacity>
            </View>
          </View>

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

        {/* Fixed Date Pickers - Place at the end of the modal */}
        {renderDatePickers()}
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
            onDayPress={(day: { dateString: React.SetStateAction<string>; }) => {
              setSelectedDate(day.dateString);
            }}
            onMonthChange={(month: { month: React.SetStateAction<number>; year: React.SetStateAction<number>; }) => {
              setCurrentMonth(month.month);
              setCurrentYear(month.year);
            }}
            markedDates={markedDates}
            theme={{
              backgroundColor: '#FFFFFF',
              calendarBackground: '#FFFFFF',
              textSectionTitleColor: '#2C3E50',
              selectedDayBackgroundColor: '#3498DB',
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: '#3498DB',
              dayTextColor: '#2C3E50',
              textDisabledColor: '#BDC3C7',
              dotColor: '#3498DB',
              selectedDotColor: '#FFFFFF',
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
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.eventSeparator} />}
            />
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome5 name="calendar-times" size={48} color="#BDC3C7" />
              <Text style={styles.emptyStateTitle}>No Events This Month</Text>
              <Text style={styles.emptyStateSubtitle}>
                Tap the + button to create your first event
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      {renderCreateEventModal()}
      {renderEventDetailsModal()}
    </SafeAreaView>
  );
};

// Styles (truncated for brevity - the full styles would include all the styling)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 16,
    marginBottom: 8,
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerButton: {
    marginRight: 16,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  eventsSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  eventsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  eventsSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
  },
  eventsCount: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
  },
  eventIndicator: {
    width: 4,
    backgroundColor: '#3498DB',
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
    marginRight: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#3498DB',
  },
  categoryText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  eventDetails: {
    marginTop: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  eventSeparator: {
    height: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 20,
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
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  modalCloseButton: {
    padding: 8,
    width: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
    textAlign: 'center',
  },
  modalSaveButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    marginTop: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    marginBottom: 24,
  },
  eventDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  eventDetailsBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  eventDetailsSection: {
    marginBottom: 24,
  },
  eventDetailsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  eventDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDetailsText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginLeft: 8,
    fontWeight: '500',
  },
  eventDetailsDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    lineHeight: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
  },
  datePickerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#7F8C8D',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    textAlign: 'center',
    flex: 1,
  },
  datePicker: {
    backgroundColor: '#FFFFFF',
    height: 200,
  },
  datePickerModalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  datePickerContent: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '50%',
  },
});

export default TeacherEventCalendarScreen;