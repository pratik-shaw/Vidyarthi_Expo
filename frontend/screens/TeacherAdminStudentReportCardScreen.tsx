import React, { useEffect, useState } from 'react';
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
  Modal,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000;
const { width: screenWidth } = Dimensions.get('window');

type TeacherAdminStudentReportCardParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAdminStudentReportCard'>;

// Define interfaces
interface Student {
  _id: string;
  name: string;
  studentId: string;
  email?: string;
  parentContact?: string;
}

interface SubjectData {
  subjectId: string;
  subjectName: string;
  teacherName?: string;
  marksScored: number | null;
  fullMarks: number;
  percentage?: number;
  grade?: string;
}

interface ExamData {
  examId: string;
  examName: string;
  examCode?: string;
  examDate?: string;
  subjects: SubjectData[];
  totalMarks?: number;
  totalFullMarks?: number;
  overallPercentage: number; // Made required
  overallGrade?: string;
}

interface StudentReportData {
  student: Student;
  exams: ExamData[];
  overallStats?: {
    totalExams: number;
    averagePercentage: number;
    bestPerformance: {
      examName: string;
      percentage: number;
    };
    weakestSubject: string;
    strongestSubject: string;
  };
}

interface ClassReportData {
  classInfo: {
    id: string;
    name: string;
    section: string;
  };
  students: StudentReportData[];
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    teacherName?: string;
  }>;
  exams: Array<{
    examId: string;
    examName: string;
    examCode?: string;
    examDate?: string;
  }>;
}

const TeacherAdminStudentReportCardScreen: React.FC<Props> = ({ route, navigation }) => {
  const { classId, className } = route.params as TeacherAdminStudentReportCardParams;

  // States
  const [reportData, setReportData] = useState<ClassReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentReportData | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingCSV, setDownloadingCSV] = useState(false);
  const [downloadingSinglePDF, setDownloadingSinglePDF] = useState(false);
const [downloadingSingleCSV, setDownloadingSingleCSV] = useState(false);

  // Set header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Student Report Cards',
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2D3748',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
      headerRight: () => (
  <View style={styles.headerActions}>
    <TouchableOpacity
      key="csv-download" // Add this key
      style={styles.headerButton}
      onPress={handleDownloadCSV}
      disabled={downloadingCSV || !reportData}
    >
      {downloadingCSV ? (
        <ActivityIndicator size="small" color="#4299E1" />
      ) : (
        <FontAwesome5 name="file-csv" size={18} color="#4299E1" />
      )}
    </TouchableOpacity>
    <TouchableOpacity
      key="pdf-download" // Add this key
      style={styles.headerButton}
      onPress={handleDownloadPDF}
      disabled={downloadingPDF || !reportData}
    >
      {downloadingPDF ? (
        <ActivityIndicator size="small" color="#E53E3E" />
      ) : (
        <FontAwesome5 name="file-pdf" size={18} color="#E53E3E" />
      )}
    </TouchableOpacity>
  </View>
),

    });
  }, [navigation, downloadingPDF, downloadingCSV, reportData]);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
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
        fetchReportData(storedToken);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data');
        setLoading(false);
      }
    };
    loadData();
  }, [classId]);

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

  // Calculate grade based on percentage
  const calculateGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C+';
    if (percentage >= 40) return 'C';
    if (percentage >= 33) return 'D';
    return 'F';
  };

  // Fetch report data from API
  // Replace the fetchReportData function with this complete implementation
const fetchReportData = async (authToken = token) => {
  setLoading(true);
  setError(null);

  try {
    if (!authToken || !isConnected) {
      setError('Authentication or network error');
      setLoading(false);
      return;
    }

    const apiClient = getAuthenticatedClient(authToken);
    
    // Fetch complete academic data for the class
    const response = await apiClient.get(`/marks/class/${classId}/complete-academic`);
    
    console.log('Report data fetched:', response.data);

    // Transform the API response to match our interface
    const transformedData: ClassReportData = {
      classInfo: response.data.classInfo || { id: classId, name: className, section: '' },
      subjects: response.data.subjects || [],
      exams: response.data.exams || [],
      students: (response.data.students || []).map((studentData: any) => {
        // Transform student data
        const student: Student = {
          _id: studentData.student?._id || studentData._id || '',
          name: studentData.student?.name || studentData.name || 'Unknown Student',
          studentId: studentData.student?.studentId || studentData.studentId || '',
          email: studentData.student?.email || studentData.email || '',
          parentContact: studentData.student?.parentContact || studentData.parentContact || ''
        };

        // Transform exam data
        const exams: ExamData[] = (studentData.exams || []).map((examData: any) => {
          const subjects: SubjectData[] = (examData.subjects || []).map((subjectData: any) => {
            const percentage = subjectData.marksScored !== null && subjectData.fullMarks > 0
              ? (subjectData.marksScored / subjectData.fullMarks) * 100
              : null;
            
            return {
              subjectId: subjectData.subjectId || '',
              subjectName: subjectData.subjectName || 'Unknown Subject',
              teacherName: subjectData.teacherName || '',
              marksScored: subjectData.marksScored,
              fullMarks: subjectData.fullMarks || 0,
              percentage: percentage,
              grade: percentage !== null ? calculateGrade(percentage) : undefined
            };
          });

          // Calculate overall exam statistics
          const totalMarks = subjects.reduce((sum, subject) => sum + (subject.marksScored || 0), 0);
          const totalFullMarks = subjects.reduce((sum, subject) => sum + subject.fullMarks, 0);
          const overallPercentage = totalFullMarks > 0 ? (totalMarks / totalFullMarks) * 100 : 0;

          return {
            examId: examData.examId || examData._id || '',
            examName: examData.examName || 'Unknown Exam',
            examCode: examData.examCode || '',
            examDate: examData.examDate || '',
            subjects: subjects,
            totalMarks: totalMarks,
            totalFullMarks: totalFullMarks,
            overallPercentage: overallPercentage,
            overallGrade: calculateGrade(overallPercentage)
          };
        });

        // Calculate overall statistics
        let overallStats = undefined;
        if (exams.length > 0) {
          const totalExams = exams.length;
          const averagePercentage = exams.reduce((sum, exam) => sum + exam.overallPercentage, 0) / totalExams;
          
          // Find best performance
          const bestPerformance = exams.reduce((best, exam) => 
            exam.overallPercentage > best.percentage 
              ? { examName: exam.examName, percentage: exam.overallPercentage }
              : best
          , { examName: '', percentage: 0 });

          // Calculate subject performance
          const subjectPerformances = new Map<string, { total: number, count: number }>();
          exams.forEach(exam => {
            exam.subjects.forEach(subject => {
              if (subject.percentage !== null) {
                const existing = subjectPerformances.get(subject.subjectName) || { total: 0, count: 0 };
                subjectPerformances.set(subject.subjectName, {
                  total: existing.total + (subject.percentage || 0),
                  count: existing.count + 1
                });
              }
            });
          });

          let strongestSubject = 'N/A';
          let weakestSubject = 'N/A';
          let maxAvg = -1;
          let minAvg = 101;

          subjectPerformances.forEach((perf, subjectName) => {
            const avg = perf.total / perf.count;
            if (avg > maxAvg) {
              maxAvg = avg;
              strongestSubject = subjectName;
            }
            if (avg < minAvg) {
              minAvg = avg;
              weakestSubject = subjectName;
            }
          });

          overallStats = {
            totalExams,
            averagePercentage,
            bestPerformance,
            strongestSubject,
            weakestSubject
          };
        }

        return {
          student,
          exams,
          overallStats
        };
      })
    };

    setReportData(transformedData);
  } catch (error) {
    console.error('Error fetching report data:', error);
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        handleSessionExpired();
      } else {
        setError(`Error: ${error.response?.data?.msg || 'Failed to fetch report data'}`);
      }
    } else {
      setError('An unknown error occurred');
    }
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
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

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  const generateSingleStudentCSV = (studentData: StudentReportData): string => {
  let csvContent = `Student Report Card\n\n`;
  
  csvContent += `Student Name: ${studentData.student.name}\n`;
  csvContent += `Student ID: ${studentData.student.studentId}\n`;
  csvContent += `Email: ${studentData.student.email || 'N/A'}\n`;
  csvContent += `Parent Contact: ${studentData.student.parentContact || 'N/A'}\n\n`;

  // Overall Statistics
  if (studentData.overallStats) {
    csvContent += `Overall Statistics:\n`;
    csvContent += `Total Exams: ${studentData.overallStats.totalExams}\n`;
    csvContent += `Average Percentage: ${studentData.overallStats.averagePercentage.toFixed(2)}%\n`;
    csvContent += `Best Performance: ${studentData.overallStats.bestPerformance.examName} (${studentData.overallStats.bestPerformance.percentage.toFixed(2)}%)\n`;
    csvContent += `Strongest Subject: ${studentData.overallStats.strongestSubject}\n`;
    csvContent += `Weakest Subject: ${studentData.overallStats.weakestSubject}\n\n`;
  }

  // Exam-wise Performance
  csvContent += `Exam-wise Performance:\n`;
  csvContent += `Exam Name,Subject,Marks Scored,Full Marks,Percentage,Grade\n`;
  
  studentData.exams.forEach(exam => {
    exam.subjects.forEach(subject => {
      csvContent += `${exam.examName},${subject.subjectName},${subject.marksScored || 'N/A'},${subject.fullMarks},${subject.percentage?.toFixed(2) || 'N/A'}%,${subject.grade || 'N/A'}\n`;
    });
    csvContent += `${exam.examName} - Overall,Total,${exam.totalMarks},${exam.totalFullMarks},${exam.overallPercentage.toFixed(2)}%,${exam.overallGrade}\n\n`;
  });

  return csvContent;
};
  // Generate CSV content
  const generateCSVContent = (): string => {
    if (!reportData) return '';

    let csvContent = `Class Report Card - ${reportData.classInfo.name}\n\n`;
    
    reportData.students.forEach((studentData, studentIndex) => {
      csvContent += `Student: ${studentData.student.name} (${studentData.student.studentId})\n`;
      csvContent += `Email: ${studentData.student.email || 'N/A'}\n`;
      csvContent += `Parent Contact: ${studentData.student.parentContact || 'N/A'}\n\n`;

      // Overall Statistics
      if (studentData.overallStats) {
        csvContent += `Overall Statistics:\n`;
        csvContent += `Total Exams: ${studentData.overallStats.totalExams}\n`;
        csvContent += `Average Percentage: ${studentData.overallStats.averagePercentage.toFixed(2)}%\n`;
        csvContent += `Best Performance: ${studentData.overallStats.bestPerformance.examName} (${studentData.overallStats.bestPerformance.percentage.toFixed(2)}%)\n`;
        csvContent += `Strongest Subject: ${studentData.overallStats.strongestSubject}\n`;
        csvContent += `Weakest Subject: ${studentData.overallStats.weakestSubject}\n\n`;
      }

      // Exam-wise Performance
      csvContent += `Exam-wise Performance:\n`;
      csvContent += `Exam Name,Subject,Marks Scored,Full Marks,Percentage,Grade\n`;
      
      studentData.exams.forEach(exam => {
        exam.subjects.forEach(subject => {
          csvContent += `${exam.examName},${subject.subjectName},${subject.marksScored || 'N/A'},${subject.fullMarks},${subject.percentage?.toFixed(2) || 'N/A'}%,${subject.grade || 'N/A'}\n`;
        });
        csvContent += `${exam.examName} - Overall,Total,${exam.totalMarks},${exam.totalFullMarks},${exam.overallPercentage.toFixed(2)}%,${exam.overallGrade}\n`;
      });

      csvContent += `\n${'='.repeat(80)}\n\n`;
    });

    return csvContent;
  };

  // Handle CSV download
  // Handle CSV download
const handleDownloadCSV = async () => {
  if (!reportData) {
    Alert.alert('Error', 'No data available to download');
    return;
  }

  setDownloadingCSV(true);
  try {
    const csvContent = generateCSVContent();
    const fileName = `${reportData.classInfo.name.replace(/[^a-z0-9]/gi, '_')}_Report_Cards_${new Date().toISOString().split('T')[0]}.csv`;
    
    const fileUri = FileSystem.documentDirectory + fileName;

    // Write file using legacy API
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Share the file
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Download Report Cards CSV',
      });
      Alert.alert('Success', 'CSV file downloaded successfully!');
    } else {
      Alert.alert('Error', 'Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error downloading CSV:', error);
    Alert.alert('Error', `Failed to download CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setDownloadingCSV(false);
  }
};

const handleDownloadSingleStudentCSV = async () => {
  if (!selectedStudent) {
    Alert.alert('Error', 'No student selected');
    return;
  }

  setDownloadingSingleCSV(true);
  try {
    const csvContent = generateSingleStudentCSV(selectedStudent);
    const fileName = `${selectedStudent.student.name.replace(/[^a-z0-9]/gi, '_')}_Report_Card_${new Date().toISOString().split('T')[0]}.csv`;
    
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Download Student Report Card CSV',
      });
      Alert.alert('Success', `CSV downloaded for ${selectedStudent.student.name}!`);
    } else {
      Alert.alert('Error', 'Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error downloading single student CSV:', error);
    Alert.alert('Error', `Failed to download CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setDownloadingSingleCSV(false);
  }
};

  // Generate PDF HTML content
  const generatePDFHTML = (): string => {
    if (!reportData) return '';

    let htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .student-section { page-break-before: always; margin-bottom: 40px; }
            .student-section:first-child { page-break-before: auto; }
            .student-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .stat-card { background: #fff; border: 1px solid #dee2e6; padding: 15px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #dee2e6; padding: 8px; text-align: left; }
            th { background: #4299E1; color: white; }
            .grade-A { background: #C6F6D5; }
            .grade-B { background: #FED7D7; }
            .grade-C { background: #FEEBC8; }
            .grade-F { background: #FED7D7; }
            .overall-row { background: #EDF2F7; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Student Report Cards</h1>
            <h2>${reportData.classInfo.name}</h2>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
    `;

    reportData.students.forEach((studentData, index) => {
      htmlContent += `
        <div class="student-section">
          <div class="student-info">
            <h3>${studentData.student.name} (${studentData.student.studentId})</h3>
            <p><strong>Email:</strong> ${studentData.student.email || 'N/A'}</p>
            <p><strong>Parent Contact:</strong> ${studentData.student.parentContact || 'N/A'}</p>
          </div>
      `;

      if (studentData.overallStats) {
        htmlContent += `
          <div class="stats-grid">
            <div class="stat-card">
              <h4>Academic Overview</h4>
              <p><strong>Total Exams:</strong> ${studentData.overallStats.totalExams}</p>
              <p><strong>Average Percentage:</strong> ${studentData.overallStats.averagePercentage.toFixed(2)}%</p>
            </div>
            <div class="stat-card">
              <h4>Performance Insights</h4>
              <p><strong>Best Performance:</strong> ${studentData.overallStats.bestPerformance.examName} (${studentData.overallStats.bestPerformance.percentage.toFixed(2)}%)</p>
              <p><strong>Strongest Subject:</strong> ${studentData.overallStats.strongestSubject}</p>
              <p><strong>Weakest Subject:</strong> ${studentData.overallStats.weakestSubject}</p>
            </div>
          </div>
        `;
      }

      htmlContent += `
        <h4>Exam-wise Performance</h4>
        <table>
          <thead>
            <tr>
              <th>Exam</th>
              <th>Subject</th>
              <th>Marks Scored</th>
              <th>Full Marks</th>
              <th>Percentage</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
      `;

      studentData.exams.forEach(exam => {
        exam.subjects.forEach((subject, subjectIndex) => {
          const gradeClass = subject.grade?.startsWith('A') ? 'grade-A' : 
                            subject.grade?.startsWith('B') ? 'grade-B' : 
                            subject.grade?.startsWith('C') ? 'grade-C' : 'grade-F';
          
          htmlContent += `
            <tr class="${gradeClass}">
              <td>${subjectIndex === 0 ? exam.examName : ''}</td>
              <td>${subject.subjectName}</td>
              <td>${subject.marksScored !== null ? subject.marksScored : 'N/A'}</td>
              <td>${subject.fullMarks}</td>
              <td>${subject.percentage ? subject.percentage.toFixed(2) + '%' : 'N/A'}</td>
              <td>${subject.grade || 'N/A'}</td>
            </tr>
          `;
        });
        
        htmlContent += `
          <tr class="overall-row">
            <td><strong>Overall</strong></td>
            <td><strong>Total</strong></td>
            <td><strong>${exam.totalMarks}</strong></td>
            <td><strong>${exam.totalFullMarks}</strong></td>
            <td><strong>${exam.overallPercentage.toFixed(2)}%</strong></td>
            <td><strong>${exam.overallGrade}</strong></td>
          </tr>
        `;
      });

      htmlContent += `
          </tbody>
        </table>
      </div>
      `;
    });

    htmlContent += `
        </body>
      </html>
    `;

    return htmlContent;
  };

  const generateSingleStudentPDFHTML = (studentData: StudentReportData): string => {
  let htmlContent = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px;
            padding: 20px;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px;
            border-bottom: 3px solid #4299E1;
            padding-bottom: 20px;
          }
          .student-info { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 25px;
            border-left: 5px solid #4299E1;
          }
          .info-row {
            display: flex;
            margin-bottom: 10px;
          }
          .info-label {
            font-weight: bold;
            width: 150px;
            color: #2D3748;
          }
          .info-value {
            color: #4A5568;
          }
          .stats-section {
            background: #EDF2F7;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 25px;
          }
          .stats-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr 1fr; 
            gap: 15px; 
            margin-bottom: 20px; 
          }
          .stat-card { 
            background: #fff; 
            border: 2px solid #CBD5E0; 
            padding: 15px; 
            border-radius: 8px;
            text-align: center;
          }
          .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #4299E1;
            margin-bottom: 5px;
          }
          .stat-label {
            font-size: 12px;
            color: #718096;
          }
          .insights {
            background: #fff;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #CBD5E0;
          }
          .insight-item {
            margin-bottom: 8px;
            color: #4A5568;
          }
          .insight-label {
            font-weight: bold;
            color: #2D3748;
          }
          .exams-section {
            margin-top: 25px;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #2D3748;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #E2E8F0;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 25px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          th, td { 
            border: 1px solid #dee2e6; 
            padding: 12px 8px; 
            text-align: left; 
          }
          th { 
            background: #4299E1; 
            color: white;
            font-weight: 600;
          }
          .exam-header {
            background: #EDF2F7;
            font-weight: bold;
            color: #2D3748;
          }
          .grade-A { background: #C6F6D5; }
          .grade-B { background: #BEE3F8; }
          .grade-C { background: #FEEBC8; }
          .grade-D { background: #FED7D7; }
          .grade-F { background: #FED7D7; }
          .overall-row { 
            background: #4299E1; 
            color: white;
            font-weight: bold; 
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #E2E8F0;
            color: #718096;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Student Report Card</h1>
          <h2>${reportData?.classInfo?.name || className}</h2>
          <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>

        <div class="student-info">
          <h3 style="margin-top: 0; color: #2D3748;">Student Information</h3>
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value">${studentData.student.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Student ID:</span>
            <span class="info-value">${studentData.student.studentId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-value">${studentData.student.email || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Parent Contact:</span>
            <span class="info-value">${studentData.student.parentContact || 'N/A'}</span>
          </div>
        </div>
  `;

  if (studentData.overallStats) {
    htmlContent += `
      <div class="stats-section">
        <h3 style="margin-top: 0; color: #2D3748;">Academic Overview</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${studentData.overallStats.totalExams}</div>
            <div class="stat-label">Total Exams</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${studentData.overallStats.averagePercentage.toFixed(1)}%</div>
            <div class="stat-label">Average Percentage</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${studentData.overallStats.bestPerformance.percentage.toFixed(1)}%</div>
            <div class="stat-label">Best Performance</div>
          </div>
        </div>
        <div class="insights">
          <div class="insight-item">
            <span class="insight-label">Best Exam:</span> 
            ${studentData.overallStats.bestPerformance.examName}
          </div>
          <div class="insight-item">
            <span class="insight-label">Strongest Subject:</span> 
            ${studentData.overallStats.strongestSubject}
          </div>
          <div class="insight-item">
            <span class="insight-label">Weakest Subject:</span> 
            ${studentData.overallStats.weakestSubject}
          </div>
        </div>
      </div>
    `;
  }

  htmlContent += `
    <div class="exams-section">
      <h3 class="section-title">Exam-wise Performance</h3>
  `;

  studentData.exams.forEach((exam, examIndex) => {
    htmlContent += `
      <table>
        <thead>
          <tr class="exam-header">
            <th colspan="6">${exam.examName} ${exam.examDate ? `(${new Date(exam.examDate).toLocaleDateString()})` : ''}</th>
          </tr>
          <tr>
            <th>Subject</th>
            <th>Teacher</th>
            <th>Marks Scored</th>
            <th>Full Marks</th>
            <th>Percentage</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
    `;

    exam.subjects.forEach(subject => {
      const gradeClass = subject.grade?.startsWith('A') ? 'grade-A' : 
                        subject.grade?.startsWith('B') ? 'grade-B' : 
                        subject.grade?.startsWith('C') ? 'grade-C' : 
                        subject.grade === 'D' ? 'grade-D' : 'grade-F';
      
      htmlContent += `
        <tr class="${gradeClass}">
          <td>${subject.subjectName}</td>
          <td>${subject.teacherName || 'N/A'}</td>
          <td>${subject.marksScored !== null ? subject.marksScored : 'N/A'}</td>
          <td>${subject.fullMarks}</td>
          <td>${subject.percentage ? subject.percentage.toFixed(2) + '%' : 'N/A'}</td>
          <td><strong>${subject.grade || 'N/A'}</strong></td>
        </tr>
      `;
    });

    htmlContent += `
          <tr class="overall-row">
            <td colspan="2"><strong>Overall Performance</strong></td>
            <td><strong>${exam.totalMarks}</strong></td>
            <td><strong>${exam.totalFullMarks}</strong></td>
            <td><strong>${exam.overallPercentage.toFixed(2)}%</strong></td>
            <td><strong>${exam.overallGrade}</strong></td>
          </tr>
        </tbody>
      </table>
    `;
  });

  htmlContent += `
      </div>
      <div class="footer">
        <p>This is an official report card generated by the Student Management System</p>
        <p>For any queries, please contact the school administration</p>
      </div>
    </body>
  </html>
  `;

  return htmlContent;
};


  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!reportData) {
      Alert.alert('Error', 'No data available to download');
      return;
    }

    setDownloadingPDF(true);
    try {
      const htmlContent = generatePDFHTML();
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Download Report Cards PDF',
      });

      Alert.alert('Success', 'PDF file generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF file');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDownloadSingleStudentPDF = async () => {
  if (!selectedStudent) {
    Alert.alert('Error', 'No student selected');
    return;
  }

  setDownloadingSinglePDF(true);
  try {
    const htmlContent = generateSingleStudentPDFHTML(selectedStudent);
    
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      base64: false,
    });

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Download Student Report Card PDF',
    });

    Alert.alert('Success', `PDF generated for ${selectedStudent.student.name}!`);
  } catch (error) {
    console.error('Error generating single student PDF:', error);
    Alert.alert('Error', 'Failed to generate PDF file');
  } finally {
    setDownloadingSinglePDF(false);
  }
};

  // Handle student detail view
  const handleStudentPress = (student: StudentReportData) => {
    setSelectedStudent(student);
    setShowDetailModal(true);
  };

  // Render student row
  const renderStudentRow = ({ item, index }: { item: StudentReportData; index: number }) => (
    <TouchableOpacity
      style={[styles.studentRow, index % 2 === 0 && styles.evenRow]}
      onPress={() => handleStudentPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.studentInfo}>
        <View style={styles.studentAvatar}>
          <Text style={styles.studentInitial}>
            {item.student.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.studentDetails}>
          <Text style={styles.studentName}>{item.student.name}</Text>
          <Text style={styles.studentId}>ID: {item.student.studentId}</Text>
        </View>
      </View>
      
      <View style={styles.studentStats}>
        <Text style={styles.statLabel}>Exams: {item.overallStats?.totalExams || 0}</Text>
        <Text style={styles.statValue}>
          Avg: {item.overallStats?.averagePercentage.toFixed(1) || '0.0'}%
        </Text>
      </View>
      
      <View style={styles.studentActions}>
        <FontAwesome5 name="chevron-right" size={16} color="#A0AEC0" />
      </View>
    </TouchableOpacity>
  );

  // Render detailed modal
  // Render detailed modal - UPDATED VERSION with fixed keys
const renderDetailModal = () => (
  <Modal
    visible={showDetailModal}
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={() => setShowDetailModal(false)}
  >
    <SafeAreaView style={styles.modalContainer}>
      {/* UPDATED HEADER with download buttons */}
      <View style={styles.modalHeader}>
        <View style={styles.modalTitleContainer}>
          <Text style={styles.modalTitle}>
            {selectedStudent?.student.name}
          </Text>
          <Text style={styles.modalSubtitle}>Report Card</Text>
        </View>
        
        {/* Download Actions */}
        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.modalActionButton}
            onPress={handleDownloadSingleStudentCSV}
            disabled={downloadingSingleCSV}
          >
            {downloadingSingleCSV ? (
              <ActivityIndicator size="small" color="#4299E1" />
            ) : (
              <FontAwesome5 name="file-csv" size={20} color="#4299E1" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.modalActionButton}
            onPress={handleDownloadSingleStudentPDF}
            disabled={downloadingSinglePDF}
          >
            {downloadingSinglePDF ? (
              <ActivityIndicator size="small" color="#E53E3E" />
            ) : (
              <FontAwesome5 name="file-pdf" size={20} color="#E53E3E" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowDetailModal(false)}
          >
            <FontAwesome5 name="times" size={20} color="#718096" />
          </TouchableOpacity>
        </View>
      </View>

      
      <ScrollView style={styles.modalContent}>
        {selectedStudent && (
          <>
            {/* Student Info */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Student Information</Text>
              <View style={styles.infoGrid}>
  <Text key="name-label" style={styles.infoLabel}>Name:</Text>
  <Text key="name-value" style={styles.infoValue}>{selectedStudent.student.name}</Text>
  <Text key="id-label" style={styles.infoLabel}>Student ID:</Text>
  <Text key="id-value" style={styles.infoValue}>{selectedStudent.student.studentId}</Text>
  <Text key="email-label" style={styles.infoLabel}>Email:</Text>
  <Text key="email-value" style={styles.infoValue}>{selectedStudent.student.email || 'N/A'}</Text>
  <Text key="contact-label" style={styles.infoLabel}>Parent Contact:</Text>
  <Text key="contact-value" style={styles.infoValue}>{selectedStudent.student.parentContact || 'N/A'}</Text>
</View>

            </View>

            {/* Overall Stats */}
            {selectedStudent.overallStats && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Academic Overview</Text>
                <View style={styles.statsGrid}>
  <View key="total-exams-stat" style={styles.statCard}>
    <Text style={styles.statNumber}>{selectedStudent.overallStats.totalExams}</Text>
    <Text style={styles.statLabel}>Total Exams</Text>
  </View>
  <View key="average-stat" style={styles.statCard}>
    <Text style={styles.statNumber}>
      {selectedStudent.overallStats.averagePercentage.toFixed(1)}%
    </Text>
    <Text style={styles.statLabel}>Average</Text>
  </View>
  <View key="best-score-stat" style={styles.statCard}>
    <Text style={styles.statNumber}>
      {selectedStudent.overallStats.bestPerformance.percentage.toFixed(1)}%
    </Text>
    <Text style={styles.statLabel}>Best Score</Text>
  </View>
</View>
                <View style={styles.subjectInsights}>
  <Text key="strongest-subject" style={styles.insightText}>
    <Text style={styles.insightLabel}>Strongest Subject: </Text>
    {selectedStudent.overallStats.strongestSubject}
  </Text>
  <Text key="weakest-subject" style={styles.insightText}>
    <Text style={styles.insightLabel}>Weakest Subject: </Text>
    {selectedStudent.overallStats.weakestSubject}
  </Text>
</View>
              </View>
            )}

            {/* Exam Details */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Exam-wise Performance</Text>
              {selectedStudent.exams.map((exam, examIndex) => (
                <View key={exam.examId || `exam-${selectedStudent.student._id}-${examIndex}`} style={styles.examCard}>
                  <View style={styles.examHeader}>
                    <Text style={styles.examName}>{exam.examName}</Text>
                    <View style={styles.examOverall}>
                      <Text style={styles.examPercentage}>
                        {exam.overallPercentage.toFixed(1)}%
                      </Text>
                      <Text style={styles.examGrade}>{exam.overallGrade}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.subjectsContainer}>
                    {exam.subjects.map((subject, subjectIndex) => (
                      <View 
                        key={`${exam.examId || `exam-${examIndex}`}-${subject.subjectId || subject.subjectName}-${subjectIndex}`} 
                        style={styles.subjectRow}
                      >
                        <Text style={styles.subjectName}>{subject.subjectName}</Text>
                        <View style={styles.subjectScores}>
                          <Text style={styles.subjectMarks}>
                            {subject.marksScored !== null ? subject.marksScored : 'N/A'}/{subject.fullMarks}
                          </Text>
                          <Text style={[
                            styles.subjectGrade,
                            { backgroundColor: getGradeColor(subject.grade || 'N/A') }
                          ]}>
                            {subject.grade || 'N/A'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  </Modal>
);

  // Get grade color
  const getGradeColor = (grade: string): string => {
    if (grade.startsWith('A')) return '#C6F6D5';
    if (grade.startsWith('B')) return '#BEE3F8';
    if (grade.startsWith('C')) return '#FEEBC8';
    if (grade === 'D') return '#FED7D7';
    return '#FED7D7';
  };

  // Show loading indicator
  if (!reportData) {
  return (
    <SafeAreaView key="loading" style={styles.loadingContainer}>
      <StatusBar hidden={true} />
      <ActivityIndicator size="large" color="#4299E1" />
      <Text style={styles.loadingText}>Loading report cards...</Text>
    </SafeAreaView>
  );
}

  // Show error message
  if (error) {
  return (
    <SafeAreaView key="error" style={styles.errorContainer}>
      <StatusBar hidden={true} />
      <FontAwesome5 name="exclamation-triangle" size={48} color="#F56565" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={() => fetchReportData()}
      >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
      
      {/* Network Status */}
      {!isConnected && (
        <View style={styles.networkBanner}>
          <FontAwesome5 name="wifi" size={16} color="#F56565" />
          <Text style={styles.networkText}>No internet connection</Text>
        </View>
      )}

      {/* Class Info Header */}
      <View style={styles.classHeader}>
  <LinearGradient
    colors={['#4299E1', '#63B3ED']}
    style={styles.classHeaderGradient}
  >
    <Text style={styles.classTitle}>{reportData?.classInfo?.name || className}</Text>
    <Text style={styles.classSubtitle}>
      {reportData?.students?.length || 0} Students • Report Cards
    </Text>
  </LinearGradient>
</View>

      {/* Summary Stats */}
      {reportData && (
  <View style={styles.summaryContainer}>
    <View key="total-students" style={styles.summaryCard}>
      <Text style={styles.summaryNumber}>{reportData?.students?.length || 0}</Text>
      <Text style={styles.summaryLabel}>Total Students</Text>
    </View>
    <View key="total-exams" style={styles.summaryCard}>
      <Text style={styles.summaryNumber}>{reportData?.exams?.length || 0}</Text>
      <Text style={styles.summaryLabel}>Total Exams</Text>
    </View>
    <View key="total-subjects" style={styles.summaryCard}>
      <Text style={styles.summaryNumber}>{reportData?.subjects?.length || 0}</Text>
      <Text style={styles.summaryLabel}>Subjects</Text>
    </View>
  </View>
)}

      {/* Student List */}
      {reportData && reportData.students && reportData.students.length > 0 ? (
  <FlatList
  data={reportData.students}
  renderItem={renderStudentRow}
  keyExtractor={(item, index) => {
    // Ensure we always have a unique key
    const studentId = item.student?._id || item.student?.studentId || `student-${index}`;
    return `student-${studentId}`;
  }}
  style={styles.studentList}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={['#4299E1']}
    />
  }
  showsVerticalScrollIndicator={false}
/>

) : (
  <View style={styles.emptyContainer}>
    <FontAwesome5 name="clipboard-list" size={48} color="#CBD5E0" />
    <Text style={styles.emptyText}>No report cards available</Text>
    <Text style={styles.emptySubtext}>
      Students need to have exam results to generate report cards
    </Text>
  </View>
)}

      {/* Detail Modal */}
      {renderDetailModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
    fontFamily: 'System',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#E53E3E',
    textAlign: 'center',
    fontFamily: 'System',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#4299E1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FED7D7',
    padding: 8,
  },
  networkText: {
    marginLeft: 8,
    color: '#E53E3E',
    fontSize: 14,
    fontFamily: 'System',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 12,
    padding: 8,
  },
  classHeader: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classHeaderGradient: {
    padding: 20,
    alignItems: 'center',
  },
  classTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
    textAlign: 'center',
  },
  classSubtitle: {
    fontSize: 16,
    color: '#E2E8F0',
    marginTop: 4,
    fontFamily: 'System',
  },
  summaryContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3748',
    fontFamily: 'System',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
    fontFamily: 'System',
    textAlign: 'center',
  },
  studentList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginVertical: 4,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  evenRow: {
    backgroundColor: '#F8F9FA',
  },
  studentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4299E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    fontFamily: 'System',
  },
  studentId: {
    fontSize: 14,
    color: '#718096',
    fontFamily: 'System',
  },
  studentStats: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
    fontFamily: 'System',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4299E1',
    fontFamily: 'System',
  },
  studentActions: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginTop: 16,
    fontFamily: 'System',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'System',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    fontFamily: 'System',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
    fontFamily: 'System',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A5568',
    width: '40%',
    marginBottom: 8,
    fontFamily: 'System',
  },
  infoValue: {
    fontSize: 14,
    color: '#2D3748',
    width: '60%',
    marginBottom: 8,
    fontFamily: 'System',
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#EDF2F7',
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
    fontFamily: 'System',
  },
  subjectInsights: {
    marginTop: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 4,
    fontFamily: 'System',
  },
  insightLabel: {
    fontWeight: '600',
    color: '#2D3748',
  },
examCard: {
  backgroundColor: '#F8F9FA',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
  borderLeftWidth: 4,
  borderLeftColor: '#4299E1',
},
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  examName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    fontFamily: 'System',
    flex: 1,
  },
  examOverall: {
    alignItems: 'flex-end',
  },
  examPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4299E1',
    fontFamily: 'System',
  },
  examGrade: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    fontFamily: 'System',
  },
  subjectsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subjectName: {
    fontSize: 14,
    color: '#4A5568',
    fontFamily: 'System',
    flex: 1,
  },
  subjectScores: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectMarks: {
    fontSize: 14,
    color: '#2D3748',
    marginRight: 8,
    fontFamily: 'System',
  },
  subjectGrade: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3748',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'System',
  },
  modalHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 16,
  backgroundColor: '#FFFFFF',
  borderBottomWidth: 1,
  borderBottomColor: '#E2E8F0',
  elevation: 2,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
},

// Add these new styles:
modalTitleContainer: {
  flex: 1,
  marginRight: 12,
},

modalSubtitle: {
  fontSize: 14,
  color: '#718096',
  fontFamily: 'System',
  marginTop: 2,
},

modalActions: {
  flexDirection: 'row',
  alignItems: 'center',
},

modalActionButton: {
  padding: 10,
  marginRight: 8,
  backgroundColor: '#F7FAFC',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E2E8F0',
},
});

export default TeacherAdminStudentReportCardScreen;