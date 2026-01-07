import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000;

type TeacherAdminTakeAttendanceParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAdminTakeAttendance'>;

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
  const { classId, className } = route.params as unknown as TeacherAdminTakeAttendanceParams;
  
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRemarksModal, setShowRemarksModal] = useState<boolean>(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number>(-1);
  const [tempRemarks, setTempRemarks] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'late'>('all');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [existingAttendance, setExistingAttendance] = useState<AttendanceData | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState<boolean>(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useFocusEffect(
  useCallback(() => {
    const subscription = navigation.addListener('beforeRemove', (e) => {
      // If no unsaved changes, allow navigation freely
      if (!hasUnsavedChanges) {
        return;
      }

      // Prevent the default back navigation
      e.preventDefault();

      // Show confirmation dialog
      Alert.alert(
        'Unsaved Changes',
        'The changes made were not saved. Discrad the current changes and retry.',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              // First update the ref to bypass the check
              setHasUnsavedChanges(false);
              
              // Small delay to ensure state updates, then navigate
              requestAnimationFrame(() => {
                navigation.dispatch(e.data.action);
              });
            },
          },
        ],
        { 
          cancelable: false,
          onDismiss: () => {
            // This ensures if alert is dismissed any other way, user stays
            console.log('Alert dismissed - staying on screen');
          }
        }
      );
    });

    return subscription;
  }, [navigation, hasUnsavedChanges])
);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: existingAttendance ? 'Update Attendance' : 'Take Attendance',
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2C3E50',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
      },
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleSubmitAttendance}
          disabled={submitting || !hasUnsavedChanges}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[
              styles.headerButtonText,
              !hasUnsavedChanges && styles.headerButtonTextDisabled
            ]}>
              {existingAttendance ? 'Update' : 'Submit'}
            </Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, submitting, attendanceRecords, hasUnsavedChanges, existingAttendance]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

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
      
      const existingData = await checkExistingAttendance(authToken);
      
      const initialRecords = studentsData.map((student: Student) => {
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

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

  const updateAttendanceStatus = (studentId: string, status: 'present' | 'absent' | 'late') => {
    setAttendanceRecords(prev => 
      prev.map(record => 
        record.studentId === studentId 
          ? { ...record, status, isModified: true }
          : record
      )
    );
    
    setHasUnsavedChanges(true);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.02,
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
        response = await apiClient.put(`/attendance/class/${classId}/attendance/${existingAttendance.id}`, attendanceData);
      } else {
        response = await apiClient.post(`/attendance/class/${classId}/take`, attendanceData);
      }

      setShowSuccessAnimation(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowSuccessAnimation(false);
        });
      }, 2000);

      setHasUnsavedChanges(false);

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

  const getFilteredStudents = () => {
    let filtered = students;

    if (searchQuery.trim()) {
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(student => {
        const record = attendanceRecords.find(r => r.studentId === student.id);
        return record?.status === filterStatus;
      });
    }

    return filtered;
  };

  const getAttendanceStats = () => {
    const total = attendanceRecords.length;
    const present = attendanceRecords.filter(r => r.status === 'present').length;
    const absent = attendanceRecords.filter(r => r.status === 'absent').length;
    const late = attendanceRecords.filter(r => r.status === 'late').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, late, percentage };
  };

  const renderStudentItem = (student: Student) => {
    const record = attendanceRecords.find(r => r.studentId === student.id);
    if (!record) return null;

    const getStatusColor = () => {
      switch (record.status) {
        case 'present':
          return '#E8F5E9';
        case 'absent':
          return '#FFEBEE';
        case 'late':
          return '#FFF8E1';
        default:
          return '#FFFFFF';
      }
    };

    const getStatusBorder = () => {
      switch (record.status) {
        case 'present':
          return '#4CAF50';
        case 'absent':
          return '#F44336';
        case 'late':
          return '#FFC107';
        default:
          return '#E0E0E0';
      }
    };

    return (
      <View
        key={student.id}
        style={[
          styles.studentCard,
          {
            backgroundColor: getStatusColor(),
            borderLeftWidth: 4,
            borderLeftColor: getStatusBorder(),
          }
        ]}
      >
        <View style={styles.studentHeader}>
          <View style={styles.studentTextInfo}>
            <Text style={styles.studentName}>{student.name}</Text>
            <Text style={styles.studentId}>ID: {student.studentId}</Text>
            {record.remarks && (
              <View style={styles.remarksPreviewContainer}>
                <FontAwesome5 name="comment" size={10} color="#7F8C8D" />
                <Text style={styles.remarksPreview} numberOfLines={1}>
                  {record.remarks}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.remarksButton}
            onPress={() => openRemarksModal(student.id)}
            activeOpacity={0.7}
          >
            <FontAwesome5 
              name="comment-dots" 
              size={18} 
              color={record.remarks ? '#3498DB' : '#BDC3C7'} 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.statusButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.statusButton,
              styles.presentButton,
              record.status === 'present' && styles.presentButtonActive
            ]}
            onPress={() => updateAttendanceStatus(student.id, 'present')}
            activeOpacity={0.7}
          >
            <FontAwesome5 
              name="check-circle" 
              size={18} 
              color={record.status === 'present' ? '#FFFFFF' : '#4CAF50'} 
            />
            <Text style={[
              styles.statusButtonText,
              record.status === 'present' && styles.statusButtonTextActive
            ]}>
              Present
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusButton,
              styles.absentButton,
              record.status === 'absent' && styles.absentButtonActive
            ]}
            onPress={() => updateAttendanceStatus(student.id, 'absent')}
            activeOpacity={0.7}
          >
            <FontAwesome5 
              name="times-circle" 
              size={18} 
              color={record.status === 'absent' ? '#FFFFFF' : '#F44336'} 
            />
            <Text style={[
              styles.statusButtonText,
              record.status === 'absent' && styles.statusButtonTextActive
            ]}>
              Absent
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusButton,
              styles.lateButton,
              record.status === 'late' && styles.lateButtonActive
            ]}
            onPress={() => updateAttendanceStatus(student.id, 'late')}
            activeOpacity={0.7}
          >
            <FontAwesome5 
              name="clock" 
              size={18} 
              color={record.status === 'late' ? '#FFFFFF' : '#FFC107'} 
            />
            <Text style={[
              styles.statusButtonText,
              record.status === 'late' && styles.statusButtonTextActive
            ]}>
              Late
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Loading students...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <FontAwesome5 name="exclamation-triangle" size={48} color="#E74C3C" />
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {showSuccessAnimation && (
        <Animated.View style={[styles.successOverlay, { opacity: fadeAnim }]}>
          <View style={styles.successContent}>
            <FontAwesome5 name="check-circle" size={48} color="#4CAF50" />
            <Text style={styles.successText}>
              {existingAttendance ? 'Updated!' : 'Submitted!'}
            </Text>
          </View>
        </Animated.View>
      )}
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3498DB']}
            tintColor="#3498DB"
          />
        }
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <LinearGradient
            colors={existingAttendance ? ['#EF5350', '#E53935'] : ['#3498DB', '#2ECC71']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <FontAwesome5 
                  name={existingAttendance ? "edit" : "clipboard-check"} 
                  size={24} 
                  color="#FFFFFF" 
                />
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>{className}</Text>
                  <Text style={styles.headerSubtitle}>
                    {existingAttendance ? 'Update' : 'Take'} attendance • {selectedDate}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {hasUnsavedChanges && (
          <View style={styles.unsavedBanner}>
            <FontAwesome5 name="exclamation-circle" size={16} color="#E67E22" />
            <Text style={styles.unsavedText}>You have unsaved changes</Text>
          </View>
        )}

        {/* Statistics Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.present}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#F44336' }]}>{stats.absent}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#FFC107' }]}>{stats.late}</Text>
              <Text style={styles.statLabel}>Late</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#3498DB' }]}>{stats.percentage}%</Text>
              <Text style={styles.statLabel}>Rate</Text>
            </View>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickActionBtn} onPress={markAllPresent}>
              <FontAwesome5 name="check-circle" size={16} color="#4CAF50" />
              <Text style={styles.quickActionText}>All Present</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.quickActionBtn} onPress={markAllAbsent}>
              <FontAwesome5 name="times-circle" size={16} color="#F44336" />
              <Text style={styles.quickActionText}>All Absent</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {(['all', 'present', 'absent', 'late'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterChip,
                  filterStatus === status && styles.activeFilterChip
                ]}
                onPress={() => setFilterStatus(status)}
              >
                <Text style={[
                  styles.filterChipText,
                  filterStatus === status && styles.activeFilterChipText
                ]}>
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#7F8C8D" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search students..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#BDC3C7"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <FontAwesome5 name="times" size={16} color="#7F8C8D" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Students List */}
        <View style={styles.studentsContainer}>
          {filteredStudents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="users" size={48} color="#BDC3C7" />
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
            </View>) : (
            filteredStudents.map(student => renderStudentItem(student))
          )}
        </View>
      </ScrollView>

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
                <FontAwesome5 name="times" size={20} color="#7F8C8D" />
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
              placeholderTextColor="#BDC3C7"
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
    backgroundColor: '#F8F9FC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
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
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    marginTop: 24,
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
    color: '#2C3E50',
  },
  headerCard: {
    margin: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerGradient: {
    borderRadius: 16,
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1CB5E0',
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerButtonTextDisabled: {
    color: '#BDC3C7',
  },
  unsavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF5E7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#E67E22',
  },
  unsavedText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#D68910',
    fontWeight: '500',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E8E8E8',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
    fontWeight: '500',
  },
  controlsContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  quickActionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  filterRow: {
    marginTop: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activeFilterChip: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  activeFilterChipText: {
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#2C3E50',
  },
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  instructionText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#2874A6',
    fontWeight: '500',
    flex: 1,
  },
  studentsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  studentTextInfo: {
    flex: 1,
    marginRight: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  remarksPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  remarksPreview: {
    fontSize: 12,
    color: '#7F8C8D',
    fontStyle: 'italic',
    marginLeft: 6,
    flex: 1,
  },
  remarksButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F7FAFC',
  },
  statusButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 1.5,
  },
  presentButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#4CAF50',
  },
  absentButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F44336',
  },
  lateButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFC107',
  },
  statusButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3498DB',
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
    color: '#2C3E50',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalStudentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498DB',
    marginBottom: 16,
  },
  remarksInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2C3E50',
    textAlignVertical: 'top',
    minHeight: 100,
    backgroundColor: '#FAFAFA',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#7F8C8D',
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
    backgroundColor: '#F7FAFC',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  modalSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#3498DB',
    borderRadius: 8,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  presentButtonActive: {
    backgroundColor: '#4CAF50',
  },
  absentButtonActive: {
    backgroundColor: '#F44336',
  },
  lateButtonActive: {
    backgroundColor: '#FFC107',
  },
});

export default TeacherAdminTakeAttendanceScreen;