import React, { useEffect, useState } from 'react';
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
  Modal,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';

import { API_BASE_URL } from '../config/api';

const { width } = Dimensions.get('window');

// API Configuration
const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000;

type TeacherAttendanceSheetParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAttendanceSheet'>;

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: string;
  remarks: string;
}

interface AttendanceData {
  id: string;
  date: string;
  records: AttendanceRecord[];
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  attendancePercentage: number;
  takenAt: string;
}

interface AttendanceSummary {
  id: string;
  date: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  attendancePercentage: number;
  takenAt: string;
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

// Helper function to format date as dd/mm/yyyy
const formatDateDDMMYYYY = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper function to parse dd/mm/yyyy string to Date
const parseDateDDMMYYYY = (dateString: string): Date => {
  const [day, month, year] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day);
};

const TeacherAttendanceSheetScreen: React.FC<Props> = ({ route, navigation }) => {
  const { classId, className } = route.params as unknown as TeacherAttendanceSheetParams;
  
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceSummary[]>([]);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceData | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [downloadingPDF, setDownloadingPDF] = useState<boolean>(false);
  const [downloadingAll, setDownloadingAll] = useState<boolean>(false);
  
  // Date filter states
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Set header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `Attendance Sheets - ${className}`,
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
          onPress={handleDownloadAllPDFs}
          disabled={downloadingAll || attendanceHistory.length === 0}
        >
          {downloadingAll ? (
            <ActivityIndicator size="small" color="#4299E1" />
          ) : (
            <FontAwesome5 name="download" size={16} color="#4299E1" />
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, className, downloadingAll, attendanceHistory.length]);

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
        fetchAttendanceHistory(storedToken);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data');
        setLoading(false);
      }
    };
    
    loadData();
  }, [classId]);

  // Fetch attendance history when date filters change
  useEffect(() => {
    if (token) {
      fetchAttendanceHistory(token);
    }
  }, [startDate, endDate, currentPage]);

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

  // Fetch attendance history
  const fetchAttendanceHistory = async (authToken = token, page = currentPage) => {
    if (page === 1) {
      setLoading(true);
    }
    setError(null);
    
    try {
      if (!authToken) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'TeacherLogin' }],
        });
        return;
      }

      const apiClient = getAuthenticatedClient(authToken);
      const params = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        page: page.toString(),
        limit: '10'
      };

      const response = await apiClient.get(`/attendance/class/${classId}/history`, { params });
      
      if (page === 1) {
        setAttendanceHistory(response.data.attendance || []);
      } else {
        setAttendanceHistory(prev => [...prev, ...(response.data.attendance || [])]);
      }
      
      setClassInfo(response.data.classInfo);
      setTotalPages(response.data.pagination?.totalPages || 1);
      setHasMore(response.data.pagination?.hasMore || false);
      
      console.log('Attendance history fetched:', response.data.attendance?.length || 0, 'records');
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else if (error.response?.status === 403) {
          setError('Not authorized to view this class attendance');
        } else {
          setError(`Error: ${error.response?.data?.msg || 'Failed to fetch attendance history'}`);
        }
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch detailed attendance for a specific date
  const fetchAttendanceDetails = async (date: string) => {
    setLoadingDetails(true);
    
    try {
      if (!token) return;

      const apiClient = getAuthenticatedClient(token);
      const response = await apiClient.get(`/attendance/class/${classId}/date`, {
        params: { date }
      });
      
      setSelectedAttendance(response.data.attendance);
      setModalVisible(true);
      console.log('Attendance details fetched for date:', date);
    } catch (error) {
      console.error('Error fetching attendance details:', error);
      
      if (axios.isAxiosError(error)) {
        Alert.alert('Error', error.response?.data?.msg || 'Failed to fetch attendance details');
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  // Generate PDF for single attendance record
  const generateAttendancePDF = async (attendance: AttendanceData | AttendanceSummary, detailed = false) => {
    try {
      let attendanceData = attendance;
      
      // If not detailed data, fetch it
      if (!detailed && 'records' in attendance === false) {
        const apiClient = getAuthenticatedClient(token);
        const response = await apiClient.get(`/attendance/class/${classId}/date`, {
          params: { date: attendance.date }
        });
        attendanceData = response.data.attendance;
      }

      const htmlContent = generateHTMLContent(attendanceData as AttendanceData);
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      return uri;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  };

  // Download single PDF
  const handleDownloadPDF = async (attendance: AttendanceSummary) => {
    setDownloadingPDF(true);
    
    try {
      const pdfUri = await generateAttendancePDF(attendance);
      const fileName = `attendance_${className}_${attendance.date}.pdf`;
      
      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(pdfUri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
        });
      } else {
        const downloadDir = `${FileSystem.documentDirectory}Downloads/`;
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
        const newUri = `${downloadDir}${fileName}`;
        await FileSystem.moveAsync({ from: pdfUri, to: newUri });
        
        Alert.alert(
          'Download Complete',
          `PDF saved as ${fileName}`,
          [
            { text: 'OK' },
            { 
              text: 'Share', 
              onPress: () => Share.share({ url: newUri, message: `Attendance sheet for ${className} - ${attendance.date}` })
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', 'Failed to download PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  // Download all PDFs
  const handleDownloadAllPDFs = async () => {
    if (attendanceHistory.length === 0) {
      Alert.alert('No Data', 'No attendance records available to download');
      return;
    }

    Alert.alert(
      'Download All PDFs',
      `This will download ${attendanceHistory.length} PDF files. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: downloadAllPDFs }
      ]
    );
  };

  const downloadAllPDFs = async () => {
    setDownloadingAll(true);
    
    try {
      const downloadPromises = attendanceHistory.map(async (attendance) => {
        try {
          return await generateAttendancePDF(attendance);
        } catch (error) {
          console.error(`Error generating PDF for ${attendance.date}:`, error);
          return null;
        }
      });

      const pdfUris = await Promise.all(downloadPromises);
      const successfulDownloads = pdfUris.filter(uri => uri !== null);

      if (Platform.OS === 'ios') {
        // Share PDFs one by one on iOS since shareAsync expects a single string
        for (const uri of successfulDownloads) {
          if (uri) {
            await Sharing.shareAsync(uri, {
              UTI: '.pdf',
              mimeType: 'application/pdf',
            });
          }
        }
      } else {
        // Save all PDFs to Downloads folder on Android
        const downloadDir = `${FileSystem.documentDirectory}Downloads/`;
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });

        for (let i = 0; i < successfulDownloads.length; i++) {
          const uri = successfulDownloads[i];
          if (uri) {
            const attendance = attendanceHistory[i];
            const fileName = `attendance_${className}_${attendance.date}.pdf`;
            const newUri = `${downloadDir}${fileName}`;
            await FileSystem.moveAsync({ from: uri, to: newUri });
          }
        }

        Alert.alert(
          'Download Complete',
          `Successfully downloaded ${successfulDownloads.length} PDF files`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error downloading all PDFs:', error);
      Alert.alert('Error', 'Failed to download some PDF files');
    } finally {
      setDownloadingAll(false);
    }
  };

  // Generate HTML content for PDF
  const generateHTMLContent = (attendance: AttendanceData): string => {
    const date = new Date(attendance.date);
    const formattedDate = formatDateDDMMYYYY(date);
    const fullDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const studentsHTML = attendance.records.map((record, index) => `
      <tr style="${index % 2 === 0 ? 'background-color: #f8f9fa;' : ''}">
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: center;">${index + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${record.studentName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6; text-align: center;">
          <span style="
            padding: 4px 8px; 
            border-radius: 12px; 
            font-size: 12px; 
            font-weight: 600;
            color: white;
            background-color: ${getStatusColor(record.status)};
          ">
            ${record.status.toUpperCase()}
          </span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">${record.remarks || '-'}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Attendance Sheet - ${className}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #ffffff;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #4299e1;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              color: #2d3748;
              margin-bottom: 8px;
            }
            .subtitle {
              font-size: 16px;
              color: #718096;
              margin-bottom: 4px;
            }
            .date {
              font-size: 18px;
              color: #4299e1;
              font-weight: 600;
            }
            .stats {
              display: flex;
              justify-content: space-around;
              margin: 20px 0;
              background-color: #f7fafc;
              padding: 15px;
              border-radius: 8px;
            }
            .stat-item {
              text-align: center;
            }
            .stat-value {
              font-size: 20px;
              font-weight: bold;
              color: #2d3748;
            }
            .stat-label {
              font-size: 12px;
              color: #718096;
              margin-top: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            th {
              background-color: #4299e1;
              color: white;
              padding: 15px 12px;
              text-align: left;
              font-weight: 600;
              font-size: 14px;
            }
            th:first-child, td:first-child {
              text-align: center;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #dee2e6;
              vertical-align: middle;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 12px;
              color: #718096;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Attendance Sheet</div>
            <div class="subtitle">${classInfo?.name || className} - ${classInfo?.section || ''}</div>
            <div class="date">${formattedDate} (${fullDate})</div>
          </div>

          <div class="stats">
            <div class="stat-item">
              <div class="stat-value">${attendance.totalStudents}</div>
              <div class="stat-label">Total Students</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" style="color: #10b981;">${attendance.presentCount}</div>
              <div class="stat-label">Present</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" style="color: #f59e0b;">${attendance.lateCount}</div>
              <div class="stat-label">Late</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" style="color: #ef4444;">${attendance.absentCount}</div>
              <div class="stat-label">Absent</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" style="color: #4299e1;">${attendance.attendancePercentage}%</div>
              <div class="stat-label">Attendance Rate</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 60px;">S.No</th>
                <th>Student Name</th>
                <th style="width: 100px; text-align: center;">Status</th>
                <th style="width: 200px;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${studentsHTML}
            </tbody>
          </table>

          <div class="footer">
            Generated on ${formatDateDDMMYYYY(new Date())} at ${new Date().toLocaleTimeString()} | Total Students: ${attendance.totalStudents}
          </div>
        </body>
      </html>
    `;
  };

  // Get status color for PDF
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'present': return '#10b981';
      case 'absent': return '#ef4444';
      case 'late': return '#f59e0b';
      case 'excused': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  // Handle date picker
  const handleDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || (datePickerMode === 'start' ? startDate : endDate);
    setShowDatePicker(Platform.OS === 'ios');

    if (datePickerMode === 'start') {
      setStartDate(currentDate);
    } else {
      setEndDate(currentDate);
    }

    setCurrentPage(1); // Reset pagination when date changes
  };

  // Load more data
  const loadMore = () => {
    if (hasMore && !loading && currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setCurrentPage(1);
    fetchAttendanceHistory();
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

  // Get status color for UI
  const getStatusUIColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'present': return '#10B981';
      case 'absent': return '#EF4444';
      case 'late': return '#F59E0B';
      case 'excused': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  // Render attendance row
  const renderAttendanceRow = (attendance: AttendanceSummary, index: number) => {
    const date = new Date(attendance.date);
    const formattedDate = formatDateDDMMYYYY(date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

    return (
      <TouchableOpacity
        key={attendance.id}
        style={[styles.attendanceRow, index % 2 === 0 && styles.evenRow]}
        onPress={() => fetchAttendanceDetails(attendance.date)}
      >
        <View style={styles.dateCell}>
          <Text style={styles.dateText}>{formattedDate}</Text>
          <Text style={styles.dayText}>{dayName}</Text>
        </View>
        
        <View style={styles.statsCell}>
          <View style={styles.statContainer}>
            <Text style={styles.statNumber}>{attendance.totalStudents}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statContainer}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>{attendance.presentCount}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statContainer}>
            <Text style={[styles.statNumber, { color: '#EF4444' }]}>{attendance.absentCount}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
        </View>
        
        <View style={styles.percentageCell}>
          <Text style={[styles.percentage, { color: attendance.attendancePercentage >= 75 ? '#10B981' : '#EF4444' }]}>
            {attendance.attendancePercentage}%
          </Text>
        </View>
        
        <View style={styles.actionCell}>
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDownloadPDF(attendance);
            }}
            disabled={downloadingPDF}
          >
            {downloadingPDF ? (
              <ActivityIndicator size="small" color="#4299E1" />
            ) : (
              <FontAwesome5 name="download" size={16} color="#4299E1" />
            )}
          </TouchableOpacity>
          <FontAwesome5 name="eye" size={16} color="#718096" style={{ marginLeft: 12 }} />
        </View>
      </TouchableOpacity>
    );
  };

  // Render detailed attendance modal
  const renderDetailedModal = () => (
    <Modal
      animationType="slide"
      transparent={false}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setModalVisible(false)}
          >
            <FontAwesome5 name="times" size={20} color="#4A5568" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {selectedAttendance && formatDateDDMMYYYY(new Date(selectedAttendance.date))}
          </Text>
          <TouchableOpacity
            style={styles.modaldownloadButton}
            onPress={() => selectedAttendance && handleDownloadPDF(selectedAttendance as AttendanceSummary)}
            disabled={downloadingPDF}
          >
            {downloadingPDF ? (
              <ActivityIndicator size="small" color="#4299E1" />
            ) : (
              <FontAwesome5 name="download" size={16} color="#4299E1" />
            )}
          </TouchableOpacity>
        </View>
        
        {loadingDetails ? (
          <View style={styles.modalLoadingContainer}>
            <ActivityIndicator size="large" color="#4299E1" />
            <Text style={styles.loadingText}>Loading attendance details...</Text>
          </View>
        ) : selectedAttendance ? (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Stats Card */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{selectedAttendance.totalStudents}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#10B981' }]}>{selectedAttendance.presentCount}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{selectedAttendance.lateCount}</Text>
                <Text style={styles.statLabel}>Late</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#EF4444' }]}>{selectedAttendance.absentCount}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#4299E1' }]}>{selectedAttendance.attendancePercentage}%</Text>
                <Text style={styles.statLabel}>Rate</Text>
              </View>
            </View>

            {/* Students List */}
            <View style={styles.studentsContainer}>
              <Text style={styles.studentsTitle}>Student Attendance</Text>
              {selectedAttendance.records.map((record, index) => (
                <View key={record.studentId} style={[styles.studentRow, index % 2 === 0 && styles.evenStudentRow]}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{record.studentName}</Text>
                    {record.remarks && (
                      <Text style={styles.studentRemarks}>Remarks: {record.remarks}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusUIColor(record.status) }]}>
                    <Text style={styles.statusText}>{record.status.toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );

  // Show loading indicator
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar hidden={true} />
        <ActivityIndicator size="large" color="#4299E1" />
        <Text style={styles.loadingText}>Loading attendance sheets...</Text>
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
          onPress={() => fetchAttendanceHistory()}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={true} />
      {/* Date Filter Section */}
      <View style={styles.filterContainer}>
        <View style={styles.dateFilters}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              setDatePickerMode('start');
              setShowDatePicker(true);
            }}
          >
            <FontAwesome5 name="calendar-alt" size={14} color="#4299E1" />
            <Text style={styles.dateButtonText}>
              From: {formatDateDDMMYYYY(startDate)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              setDatePickerMode('end');
              setShowDatePicker(true);
            }}
          >
            <FontAwesome5 name="calendar-alt" size={14} color="#4299E1" />
            <Text style={styles.dateButtonText}>
              To: {formatDateDDMMYYYY(endDate)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={datePickerMode === 'start' ? startDate : endDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
          minimumDate={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)} // 1 year ago
        />
      )}

      {/* Main Content */}
      {attendanceHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="clipboard-list" size={64} color="#CBD5E0" />
          <Text style={styles.emptyTitle}>No Attendance Records</Text>
          <Text style={styles.emptySubtitle}>
            No attendance sheets found for the selected date range.
          </Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, { flex: 1.2 }]}>Date</Text>
            <Text style={[styles.headerCell, { flex: 1.8 }]}>Statistics</Text>
            <Text style={[styles.headerCell, { flex: 0.8 }]}>Rate</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>Actions</Text>
          </View>

          {/* Attendance List */}
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#4299E1']}
                tintColor="#4299E1"
              />
            }
            onMomentumScrollEnd={(event) => {
              const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
              const paddingToBottom = 20;
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
                loadMore();
              }
            }}
          >
            {attendanceHistory.map((attendance, index) =>
              renderAttendanceRow(attendance, index)
            )}
            
            {/* Load More Button */}
            {hasMore && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#4299E1" />
                ) : (
                  <>
                    <FontAwesome5 name="chevron-down" size={16} color="#4299E1" />
                    <Text style={styles.loadMoreText}>Load More</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            
            {/* Pagination Info */}
            <View style={styles.paginationInfo}>
              <Text style={styles.paginationText}>
                Page {currentPage} of {totalPages} • {attendanceHistory.length} records
              </Text>
            </View>
          </ScrollView>
        </>
      )}

      {/* Detailed Attendance Modal */}
      {renderDetailedModal()}
    </SafeAreaView>
  );
};

// Styles
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
    textAlign: 'center',
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
    color: '#E53E3E',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
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
  headerButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#EBF8FF',
    marginRight: 4,
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dateFilters: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BEE3F8',
  },
  dateButtonText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#2B6CB0',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A5568',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#718096',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  refreshButton: {
    backgroundColor: '#4299E1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#4299E1',
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  attendanceRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  evenRow: {
    backgroundColor: '#F8F9FA',
  },
  dateCell: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: -15,
  },
  dayText: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  statsCell: {
    flex: 1.8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  statContainer: {
    alignItems: 'center',
    minWidth: 45,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
  },
  statLabel: {
    fontSize: 10,
    color: '#718096',
    marginTop: 3,
  },
  percentageCell: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  percentage: {
    fontSize: 17,
    fontWeight: '700',
  },
  actionCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  downloadButton: {
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#EBF8FF',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#EBF8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BEE3F8',
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2B6CB0',
    fontWeight: '500',
  },
  paginationInfo: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  paginationText: {
    fontSize: 12,
    color: '#718096',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modalCloseButton: {
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#F7FAFC',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  modaldownloadButton: {
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#EBF8FF',
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 4,
  },
  studentsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  studentsTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 14,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  evenStudentRow: {
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
  },
  studentInfo: {
    flex: 1,
    paddingRight: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D3748',
  },
  studentRemarks: {
    fontSize: 13,
    color: '#718096',
    marginTop: 4,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    marginLeft: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TeacherAttendanceSheetScreen;