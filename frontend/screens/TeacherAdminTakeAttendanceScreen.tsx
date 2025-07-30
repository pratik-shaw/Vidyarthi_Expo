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
  TextInput,
  Modal,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { API_BASE_URL } from '../config/api';

// API URL with configurable timeout
const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000; // 15 seconds timeout

// Route params type
type TeacherAdminTakeAttendanceParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAdminTakeAttendance'>;

// Define types
interface Student {
  id: string;
  name: string;
  email?: string;
  studentId: string;
}

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: 'present' | 'absent' | 'late';
  remarks: string;
  isModified?: boolean;
}

interface AttendanceData {
  id: any;
  date: string;
  records: AttendanceRecord[];
}

const TeacherAdminTakeAttendanceScreen: React.FC<Props> = ({ route, navigation }) => {
  // Get params from route
  const { classId, className } = route.params as unknown as TeacherAdminTakeAttendanceParams;
  
  // States
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showRemarksModal, setShowRemarksModal] = useState<boolean>(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number>(-1);
  const [tempRemarks, setTempRemarks] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'late'>('all');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [existingAttendance, setExistingAttendance] = useState<AttendanceData | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState<boolean>(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  // Set header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: existingAttendance ? 'Update Attendance' : 'Take Attendance',
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2D3748',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
      headerRight: () => (
  <TouchableOpacity
    style={styles.headerButton}
    onPress={handleSubmitAttendance}
    disabled={submitting || !hasUnsavedChanges}
  >
    {submitting ? (
      <ActivityIndicator size="small" color="#FFFFFF" />
    ) : (
      <Text style={styles.headerButtonText}>
        {existingAttendance ? 'Update' : 'Submit'}
      </Text>
    )}
  </TouchableOpacity>
),
    });
  }, [navigation, submitting, attendanceRecords, hasUnsavedChanges, existingAttendance]);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('teacherToken');
        
        if (!storedToken) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'TeacherLogin' }],
          });
          return;
        }
        
        setToken(storedToken);
        await Promise.all([
          fetchStudents(storedToken),
          checkExistingAttendance(storedToken)
        ]);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data');
        setLoading(false);
      }
    };
    
    loadData();
  }, [classId, selectedDate]);

  // Get authenticated API client
  const getAuthenticatedClient = (authToken = token) => {
    return axios.create({
      baseURL: API_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-auth-token': authToken,
        'Content-Type': 'application/json'
      }
    });
  };

  // Check if attendance already exists for selected date
  const checkExistingAttendance = async (authToken = token) => {
    try {
      if (!authToken) return;

      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/attendance/class/${classId}/date?date=${selectedDate}`);
      
      if (response.data && response.data.attendance) {
        setExistingAttendance(response.data.attendance);
        return response.data.attendance;
      }
      
      setExistingAttendance(null);
      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status !== 404) {
        console.error('Error checking existing attendance:', error);
      }
      setExistingAttendance(null);
      return null;
    }
  };

  // Fetch students from API
  const fetchStudents = async (authToken = token) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!authToken) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'TeacherLogin' }],
        });
        return;
      }

      if (!isConnected) {
        setError('No internet connection. Please check your network.');
        setLoading(false);
        return;
      }

      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/attendance/class/${classId}/students`);
      
      const studentsData = response.data.students.map((student: any) => ({
        id: student.id,
        name: student.name,
        email: student.email,
        studentId: student.studentId
      }));
      
      setStudents(studentsData);
      
      // Check for existing attendance
      const existingData = await checkExistingAttendance(authToken);
      
      // Initialize attendance records
      const initialRecords = studentsData.map((student: Student) => {
        // If attendance exists, use existing data, otherwise default to absent
        const existingRecord = existingData?.records?.find((r: any) => r.studentId === student.id);
        
        return {
          studentId: student.id,
          studentName: student.name,
          status: existingRecord?.status || 'absent' as const,
          remarks: existingRecord?.remarks || '',
          isModified: false
        };
      });
      
      setAttendanceRecords(initialRecords);
      setHasUnsavedChanges(false);
      
      console.log('Students fetched:', studentsData.length);
      console.log('Existing attendance:', existingData ? 'Found' : 'Not found');
    } catch (error) {
      console.error('Error fetching students:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else if (error.response?.status === 404) {
          setError('No students found in this class');
        } else {
          setError(`Error: ${error.response?.data?.msg || 'Failed to fetch students'}`);
        }
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  // Handle session expired
  const handleSessionExpired = () => {
    Alert.alert(
      "Session Expired",
      "Your session has expired. Please login again.",
      [
        {
          text: "OK",
          onPress: async () => {
            await AsyncStorage.removeItem('teacherToken');
            navigation.reset({
              index: 0,
              routes: [{ name: 'TeacherLogin' }],
            });
          }
        }
      ]
    );
  };

  // Update attendance status with animation
  const updateAttendanceStatus = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendanceRecords(prev => 
      prev.map(record => 
        record.studentId === studentId 
          ? { ...record, status, isModified: true }
          : record
      )
    );
    
    setHasUnsavedChanges(true);

    // Animate the change
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Handle remarks modal
  const openRemarksModal = (studentId: string) => {
    const index = attendanceRecords.findIndex(r => r.studentId === studentId);
    setCurrentStudentIndex(index);
    setTempRemarks(index >= 0 ? attendanceRecords[index].remarks : '');
    setShowRemarksModal(true);
  };

  const saveRemarks = () => {
    if (currentStudentIndex >= 0) {
      setAttendanceRecords(prev => 
        prev.map((record, index) => 
          index === currentStudentIndex 
            ? { ...record, remarks: tempRemarks, isModified: true }
            : record
        )
      );
      setHasUnsavedChanges(true);
    }
    setShowRemarksModal(false);
    setCurrentStudentIndex(-1);
    setTempRemarks('');
  };

  // Submit attendance with enhanced feedback
  const handleSubmitAttendance = async () => {
    try {
      setSubmitting(true);

      if (!token) {
        handleSessionExpired();
        return;
      }

      if (!isConnected) {
        Alert.alert('No Connection', 'Please check your internet connection and try again.');
        return;
      }

      // Validate attendance data
      if (attendanceRecords.length === 0) {
        Alert.alert('No Data', 'No attendance records to submit.');
        return;
      }

      const apiClient = getAuthenticatedClient(token);
      
      const attendanceData = {
        date: selectedDate,
        records: attendanceRecords.map(({ isModified, ...record }) => record)
      };

      let response;
      if (existingAttendance) {
        // Update existing attendance
        response = await apiClient.put(`/attendance/class/${classId}/attendance/${existingAttendance.id}`, attendanceData);
      } else {
        // Create new attendance
        response = await apiClient.post(`/attendance/class/${classId}/take`, attendanceData);
      }

      // Show success animation
      setShowSuccessAnimation(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Hide animation after delay
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowSuccessAnimation(false);
        });
      }, 2000);

      // Reset unsaved changes flag
      setHasUnsavedChanges(false);

      // Refresh data to show updated state
      await checkExistingAttendance(token);

      Alert.alert(
        'Success',
        `Attendance has been ${existingAttendance ? 'updated' : 'submitted'} successfully!`,
        [
          {
            text: 'Stay Here',
            style: 'cancel'
          },
          {
            text: 'Go Back',
            onPress: () => navigation.goBack()
          }
        ]
      );

      console.log('Attendance operation successful:', response.data);

    } catch (error) {
      console.error('Error submitting attendance:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else if (error.response?.status === 400) {
          const errorMsg = error.response.data?.msg || 'Failed to submit attendance';
          Alert.alert('Error', errorMsg);
        } else {
          Alert.alert('Error', `Failed to ${existingAttendance ? 'update' : 'submit'} attendance: ${error.response?.data?.msg || error.message}`);
        }
      } else {
        Alert.alert('Error', `An unknown error occurred while ${existingAttendance ? 'updating' : 'submitting'} attendance.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Quick actions for bulk operations with confirmation
  const markAllPresent = () => {
    Alert.alert(
      'Mark All Present',
      'Are you sure you want to mark all students as present?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            setAttendanceRecords(prev => 
              prev.map(record => ({ ...record, status: 'present' as const, isModified: true }))
            );
            setHasUnsavedChanges(true);
          }
        }
      ]
    );
  };

  const markAllAbsent = () => {
    Alert.alert(
      'Mark All Absent',
      'Are you sure you want to mark all students as absent?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            setAttendanceRecords(prev => 
              prev.map(record => ({ ...record, status: 'absent' as const, isModified: true }))
            );
            setHasUnsavedChanges(true);
          }
        }
      ]
    );
  };

  // Handle back button with unsaved changes warning
  const handleBackPress = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Discard', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // Override back button behavior
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasUnsavedChanges) {
        return;
      }

      e.preventDefault();
      handleBackPress();
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

  // Filter students based on search and status
  const getFilteredStudents = () => {
    let filtered = students;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(student => {
        const record = attendanceRecords.find(r => r.studentId === student.id);
        return record?.status === filterStatus;
      });
    }

    return filtered;
  };

  // Get attendance statistics
  const getAttendanceStats = () => {
    const total = attendanceRecords.length;
    const present = attendanceRecords.filter(r => r.status === 'present').length;
    const absent = attendanceRecords.filter(r => r.status === 'absent').length;
    const late = attendanceRecords.filter(r => r.status === 'late').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, late, percentage };
  };

  // Toggle header collapse
  const toggleHeaderCollapse = () => {
    setIsHeaderCollapsed(!isHeaderCollapsed);
    Animated.timing(headerAnim, {
      toValue: isHeaderCollapsed ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  // Render student item with enhanced visual feedback
  const renderStudentItem = ({ item: student }: { item: Student }) => {
    const record = attendanceRecords.find(r => r.studentId === student.id);
    if (!record) return null;

    const isModified = record.isModified;

    return (
      <Animated.View style={[
        styles.studentCard,
        isModified && styles.studentCardModified
      ]}>
        <View style={styles.studentInfo}>
          <View style={[
            styles.studentAvatar,
            record.status === 'present' && styles.studentAvatarPresent,
            record.status === 'absent' && styles.studentAvatarAbsent,
            record.status === 'late' && styles.studentAvatarLate,
          ]}>
            <Text style={styles.studentInitial}>
              {student.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          
          <View style={styles.studentDetails}>
            <View style={styles.studentNameRow}>
              <Text style={styles.studentName}>{student.name}</Text>
              {isModified && (
                <View style={styles.modifiedIndicator}>
                  <Text style={styles.modifiedText}>•</Text>
                </View>
              )}
            </View>
            <Text style={styles.studentId}>ID: {student.studentId}</Text>
            {record.remarks && (
              <Text style={styles.remarksPreview} numberOfLines={1}>
                Note: {record.remarks}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.attendanceControls}>
          <View style={styles.statusButtons}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                styles.presentButton,
                record.status === 'present' && styles.activeStatusButton
              ]}
              onPress={() => updateAttendanceStatus(student.id, 'present')}
              activeOpacity={0.7}
            >
              <FontAwesome5 
                name="check" 
                size={14} 
                color={record.status === 'present' ? '#FFFFFF' : '#48BB78'} 
              />
              <Text style={[
                styles.statusButtonText,
                record.status === 'present' && styles.activeStatusButtonText
              ]}>
                P
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                styles.absentButton,
                record.status === 'absent' && styles.activeStatusButton
              ]}
              onPress={() => updateAttendanceStatus(student.id, 'absent')}
              activeOpacity={0.7}
            >
              <FontAwesome5 
                name="times" 
                size={14} 
                color={record.status === 'absent' ? '#FFFFFF' : '#F56565'} 
              />
              <Text style={[
                styles.statusButtonText,
                record.status === 'absent' && styles.activeStatusButtonText
              ]}>
                A
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                styles.lateButton,
                record.status === 'late' && styles.activeStatusButton
              ]}
              onPress={() => updateAttendanceStatus(student.id, 'late')}
              activeOpacity={0.7}
            >
              <FontAwesome5 
                name="clock" 
                size={14} 
                color={record.status === 'late' ? '#FFFFFF' : '#ED8936'} 
              />
              <Text style={[
                styles.statusButtonText,
                record.status === 'late' && styles.activeStatusButtonText
              ]}>
                L
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.remarksButton}
            onPress={() => openRemarksModal(student.id)}
            activeOpacity={0.7}
          >
            <FontAwesome5 
              name="comment" 
              size={16} 
              color={record.remarks ? '#4299E1' : '#A0AEC0'} 
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  // Show loading indicator
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar hidden={true} />
        <ActivityIndicator size="large" color="#4299E1" />
        <Text style={styles.loadingText}>Loading students...</Text>
      </SafeAreaView>
    );
  }

  // Show error message
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar hidden={true} />
        <FontAwesome5 name="exclamation-triangle" size={48} color="#F56565" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => fetchStudents()}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const stats = getAttendanceStats();
  const filteredStudents = getFilteredStudents();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={true} />
      
      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <Animated.View style={[styles.successOverlay, { opacity: fadeAnim }]}>
          <View style={styles.successContent}>
            <FontAwesome5 name="check-circle" size={48} color="#48BB78" />
            <Text style={styles.successText}>
              {existingAttendance ? 'Updated!' : 'Submitted!'}
            </Text>
          </View>
        </Animated.View>
      )}
      
      {/* Collapsible Header Card */}
      <Animated.View style={[
        styles.headerCard,
        {
          height: headerAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [120, 60],
          }),
        },
      ]}>
        <LinearGradient
          colors={existingAttendance ? ['#FEB2B2', '#F56565'] : ['#667EEA', '#764BA2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <TouchableOpacity 
            style={styles.headerContent}
            onPress={toggleHeaderCollapse}
            activeOpacity={0.8}
          >
            <View style={styles.headerLeft}>
              <FontAwesome5 
                name={existingAttendance ? "edit" : "clipboard-check"} 
                size={20} 
                color="#FFFFFF" 
              />
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>{className}</Text>
                <Animated.View style={{
                  opacity: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                }}>
                  <Text style={styles.headerSubtitle}>
                    {existingAttendance ? 'Update attendance for' : 'Take attendance for'} {selectedDate}
                  </Text>
                </Animated.View>
              </View>
            </View>
            <FontAwesome5 
              name={isHeaderCollapsed ? "chevron-down" : "chevron-up"} 
              size={16} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>

      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <View style={styles.unsavedBanner}>
          <FontAwesome5 name="exclamation-circle" size={16} color="#ED8936" />
          <Text style={styles.unsavedText}>You have unsaved changes</Text>
        </View>
      )}

      {/* Compact Statistics Card */}
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#48BB78' }]}>{stats.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#F56565' }]}>{stats.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#ED8936' }]}>{stats.late}</Text>
            <Text style={styles.statLabel}>Late</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4299E1' }]}>{stats.percentage}%</Text>
            <Text style={styles.statLabel}>Rate</Text>
          </View>
        </View>
      </View>

      {/* Compact Controls Row */}
      <View style={styles.controlsRow}>
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionButton} onPress={markAllPresent}>
            <FontAwesome5 name="check-circle" size={14} color="#48BB78" />
            <Text style={styles.quickActionText}>All P</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickActionButton} onPress={markAllAbsent}>
            <FontAwesome5 name="times-circle" size={14} color="#F56565" />
            <Text style={styles.quickActionText}>All A</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['all', 'present', 'absent', 'late'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                filterStatus === status && styles.activeFilterButton
              ]}
              onPress={() => setFilterStatus(status as typeof filterStatus)}
            >
              <Text style={[
                styles.filterButtonText,
                filterStatus === status && styles.activeFilterButtonText
              ]}>
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Compact Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <FontAwesome5 name="search" size={14} color="#A0AEC0" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#A0AEC0"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <FontAwesome5 name="times" size={14} color="#A0AEC0" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Students List */}
      <FlatList
        data={filteredStudents}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4299E1']}
            tintColor="#4299E1"
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="users" size={48} color="#CBD5E0" />
            <Text style={styles.emptyText}>
              {searchQuery || filterStatus !== 'all' ? 'No students match your filters' : 'No students found'}
            </Text>
            {(searchQuery || filterStatus !== 'all') && (
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
              >
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* Remarks Modal */}
      <Modal
        visible={showRemarksModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRemarksModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Remarks</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowRemarksModal(false)}
              >
                <FontAwesome5 name="times" size={20} color="#718096" />
              </TouchableOpacity>
            </View>
            
            {currentStudentIndex >= 0 && (
              <Text style={styles.modalStudentName}>
                {attendanceRecords[currentStudentIndex]?.studentName}
              </Text>
            )}
            
            <TextInput
              style={styles.remarksInput}
              placeholder="Enter remarks or notes..."
              value={tempRemarks}
              onChangeText={setTempRemarks}
              multiline={true}
              numberOfLines={4}
              maxLength={200}
              placeholderTextColor="#A0AEC0"
            />
            
            <Text style={styles.charCount}>
              {tempRemarks.length}/200
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowRemarksModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveRemarks}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A5568',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#4299E1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successContent: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
  },
  headerCard: {
    overflow: 'hidden',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerGradient: {
    flex: 1,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 2,
  },
  headerButton: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 8,
  backgroundColor: '#000000', // Solid black background
},
  headerButtonHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerButtonText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#FFFFFF', // White text
},
  headerButtonTextHighlight: {
    color: '#FFFFFF',
  },
  headerButtonTextDisabled: {
    color: '#A0AEC0',
  },
  unsavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FED7D7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  unsavedText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#C53030',
    fontWeight: '500',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  quickActions: {
    flexDirection: 'row',
    marginRight: 12,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickActionText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#4A5568',
  },
  filterScroll: {
    flex: 1,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFilterButton: {
    backgroundColor: '#4299E1',
    borderColor: '#4299E1',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#2D3748',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  studentCardModified: {
    borderLeftWidth: 4,
    borderLeftColor: '#4299E1',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentAvatarPresent: {
    backgroundColor: '#48BB78',
  },
  studentAvatarAbsent: {
    backgroundColor: '#F56565',
  },
  studentAvatarLate: {
    backgroundColor: '#ED8936',
  },
  studentInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentDetails: {
    flex: 1,
  },
  studentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  modifiedIndicator: {
    marginLeft: 8,
  },
  modifiedText: {
    fontSize: 16,
    color: '#4299E1',
    fontWeight: '700',
  },
  studentId: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
  },
  remarksPreview: {
    fontSize: 12,
    color: '#4299E1',
    marginTop: 4,
    fontStyle: 'italic',
  },
  attendanceControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusButtons: {
    flexDirection: 'row',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
  },
  presentButton: {
    backgroundColor: '#F0FFF4',
    borderColor: '#48BB78',
  },
  absentButton: {
    backgroundColor: '#FFF5F5',
    borderColor: '#F56565',
  },
  lateButton: {
    backgroundColor: '#FFFAF0',
    borderColor: '#ED8936',
  },
  activeStatusButton: {
    backgroundColor: '#4299E1',
    borderColor: '#4299E1',
  },
  statusButtonText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#4A5568',
  },
  activeStatusButtonText: {
    color: '#FFFFFF',
  },
  remarksButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F7FAFC',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#4299E1',
    borderRadius: 8,
  },
  clearFiltersText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalStudentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4299E1',
    marginBottom: 16,
  },
  remarksInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2D3748',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#718096',
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#718096',
  },
  modalSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#4299E1',
    borderRadius: 8,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TeacherAdminTakeAttendanceScreen;