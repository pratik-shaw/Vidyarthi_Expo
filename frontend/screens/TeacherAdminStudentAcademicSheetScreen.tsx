import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../config/api';
import * as Print from 'expo-print';

interface RouteParams {
  classId: string;
  className: string;
}

interface Subject {
  subjectId: string;
  subjectName: string;
  teacherId: string;
  fullMarks: number;
  marksScored: number | null;
  scoredBy: string | null;
  scoredAt: string | null;
}

interface Exam {
  examId: string;
  examName: string;
  examCode: string;
  examDate: string;
  subjects: Subject[];
  totalMarksScored: number;
  totalFullMarks: number;
  percentage: string;
  isCompleted: boolean;
  completedSubjects: number;
  totalSubjects: number;
}

interface Student {
  studentId: string;
  studentName: string;
  studentNumber: string;
  exams: Exam[];
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

interface TeacherInfo {
  id: string;
  name: string;
}

interface ApiResponse {
  students: Student[];
  classInfo: ClassInfo;
  teacherInfo: TeacherInfo;
  totalStudents: number;
  message?: string;
}

const TeacherAdminStudentAcademicSheetScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { classId, className }: RouteParams = route.params;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [studentsData, setStudentsData] = useState<Student[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [currentExcelHTML, setCurrentExcelHTML] = useState<string>('');
  const [currentExamName, setCurrentExamName] = useState<string>('');
  const [availableExams, setAvailableExams] = useState<string[]>([]);

  // Set header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `Academic Sheets - ${className}`,
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2D3748',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
    });
  }, [navigation, className]);

  useEffect(() => {
    fetchStudentsData();
  }, []);

  const fetchStudentsData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('teacherToken');
      
      if (!token) {
        Alert.alert('Error', 'Authentication token not found');
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/marks/class/${classId}/complete-academic`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token,
          },
        }
      );

      const data: ApiResponse = await response.json();

      if (response.ok) {
        setStudentsData(data.students);
        setClassInfo(data.classInfo);
        
        const exams = new Set<string>();
        data.students.forEach(student => {
          student.exams.forEach(exam => {
            exams.add(`${exam.examId}|${exam.examName}|${exam.examCode}`);
          });
        });
        
        setAvailableExams(Array.from(exams));
      } else {
        Alert.alert('Error', data.message || 'Failed to fetch students data');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStudentsData();
    setRefreshing(false);
  };

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

  const handleWebViewMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'download') {
        const { format, data, filename } = message;
        
        if (format === 'pdf') {
          try {
            const htmlContent = atob(data);
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Share PDF File',
              });
            } else {
              Alert.alert('Success', `PDF saved to: ${uri}`);
            }
          } catch (error) {
            console.error('PDF creation error:', error);
            Alert.alert('Error', 'Failed to create PDF file');
          }
        } else {
          const fileUri = FileSystem.documentDirectory + filename;
          
          await FileSystem.writeAsStringAsync(fileUri, data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
              dialogTitle: `Share ${format.toUpperCase()} File`,
            });
          } else {
            Alert.alert('Success', `File saved to: ${fileUri}`);
          }
        }
      }
    } catch (error) {
      console.error('File download error:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const generateExcelHTML = (examId: string, examName: string, examCode: string): string => {
    const examData = studentsData.map(student => {
      const exam = student.exams.find(e => e.examId === examId);
      return {
        ...student,
        exam: exam || null
      };
    }).filter(student => student.exam !== null);

    if (examData.length === 0) {
      return '<html><body><h2>No data available for this exam</h2></body></html>';
    }

    const allSubjects = new Map<string, { subjectId: string; subjectName: string }>();
    
    examData.forEach(student => {
      if (student.exam) {
        student.exam.subjects.forEach(subject => {
          if (subject.subjectId && subject.subjectName && subject.subjectName !== 'Unknown Subject') {
            if (!allSubjects.has(subject.subjectId)) {
              allSubjects.set(subject.subjectId, {
                subjectId: subject.subjectId,
                subjectName: subject.subjectName
              });
            }
          }
        });
      }
    });

    const subjects = Array.from(allSubjects.values());

    if (subjects.length === 0) {
      return '<html><body><h2>No valid subjects found for this exam</h2></body></html>';
    }

    const totalStudents = examData.length;
    const completedStudents = examData.filter(student => student.exam?.isCompleted).length;
    const averagePercentage = examData.reduce((sum, student) => {
      return sum + (student.exam ? parseFloat(student.exam.percentage) : 0);
    }, 0) / totalStudents;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${examName} - Academic Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header h1 {
            color: #2d3748;
            margin: 0;
        }
        .header h2 {
            color: #4a5568;
            margin: 5px 0;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            gap: 10px;
        }
        .stat-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            flex: 1;
        }
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #3182ce;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        .download-section {
            text-align: center;
            margin: 20px 0;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .download-btn {
            background: #3182ce;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            margin: 0 10px;
            margin-bottom: 10px;
        }
        .download-btn:hover {
            background: #2c5282;
        }
        .download-btn:disabled {
            background: #a0aec0;
            cursor: not-allowed;
        }
        .table-container {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-top: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px 8px;
            text-align: center;
            border: 1px solid #e2e8f0;
            font-size: 12px;
        }
        th {
            background-color: #edf2f7;
            font-weight: bold;
            color: #2d3748;
        }
        tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        tr:hover {
            background-color: #e6fffa;
        }
        .student-name {
            text-align: left;
            font-weight: 500;
            max-width: 150px;
        }
        .completed {
            color: #38a169;
            font-weight: bold;
        }
        .incomplete {
            color: #e53e3e;
        }
        .grade-a { color: #38a169; font-weight: bold; }
        .grade-b { color: #3182ce; font-weight: bold; }
        .grade-c { color: #d69e2e; font-weight: bold; }
        .grade-d { color: #e53e3e; font-weight: bold; }
        .grade-f { color: #e53e3e; font-weight: bold; background-color: #fed7d7; }
        .loading-message {
            text-align: center;
            color: #666;
            font-style: italic;
            margin: 10px 0;
        }
        @media print {
            .download-section {
                display: none;
            }
            body {
                background-color: white;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${classInfo?.name || 'Class'} - ${classInfo?.section || ''}</h1>
        <h2>${examName} (${examCode})</h2>
        <p>Academic Performance Report</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${totalStudents}</div>
            <div class="stat-label">Total Students</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${completedStudents}</div>
            <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${averagePercentage.toFixed(1)}%</div>
            <div class="stat-label">Average</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${subjects.length}</div>
            <div class="stat-label">Subjects</div>
        </div>
    </div>

    <div class="download-section">
        <button class="download-btn" onclick="downloadAsPDF()">Download PDF</button>
        <button class="download-btn" id="excelBtn" onclick="downloadAsExcel()" disabled>
            <span id="excelBtnText">Loading...</span>
        </button>
        <button class="download-btn" id="csvBtn" onclick="downloadAsCSV()" disabled>
            <span id="csvBtnText">Loading...</span>
        </button>
        <div class="loading-message" id="loadingMessage">Loading Excel library...</div>
    </div>

    <div class="table-container">
        <table id="academicTable">
            <thead>
                <tr>
                    <th rowspan="2">S.No</th>
                    <th rowspan="2">Student Name</th>
                    <th rowspan="2">Student ID</th>
                    ${subjects.map(sub => `<th colspan="2">${sub.subjectName}</th>`).join('')}
                    <th rowspan="2">Total Marks</th>
                    <th rowspan="2">Full Marks</th>
                    <th rowspan="2">Percentage</th>
                    <th rowspan="2">Grade</th>
                    <th rowspan="2">Status</th>
                </tr>
                <tr>
                    ${subjects.map(() => '<th>Marks</th><th>Out of</th>').join('')}
                </tr>
            </thead>
            <tbody>
                ${examData.map((student, index) => {
                  const exam = student.exam!;
                  const percentage = parseFloat(exam.percentage);
                  const grade = calculateGrade(percentage);
                  const gradeClass = grade.startsWith('A') ? 'grade-a' : 
                                   grade.startsWith('B') ? 'grade-b' : 
                                   grade.startsWith('C') ? 'grade-c' : 
                                   grade === 'D' ? 'grade-d' : 'grade-f';
                  
                  return `
                    <tr>
                        <td>${index + 1}</td>
                        <td class="student-name">${student.studentName}</td>
                        <td>${student.studentNumber}</td>
                        ${subjects.map(subject => {
                          const subjectData = exam.subjects.find(s => s.subjectId === subject.subjectId);
                          if (subjectData) {
                            return `
                              <td>${subjectData.marksScored !== null ? subjectData.marksScored : '-'}</td>
                              <td>${subjectData.fullMarks}</td>
                            `;
                          }
                          return '<td>-</td><td>-</td>';
                        }).join('')}
                        <td><strong>${exam.totalMarksScored}</strong></td>
                        <td><strong>${exam.totalFullMarks}</strong></td>
                        <td><strong>${exam.percentage}%</strong></td>
                        <td class="${gradeClass}"><strong>${grade}</strong></td>
                        <td class="${exam.isCompleted ? 'completed' : 'incomplete'}">
                            ${exam.isCompleted ? 'Complete' : `${exam.completedSubjects}/${exam.totalSubjects}`}
                        </td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
        </table>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script>
        let isLibraryLoaded = false;

        function updateButtonStates(loaded) {
            const excelBtn = document.getElementById('excelBtn');
            const csvBtn = document.getElementById('csvBtn');
            const excelBtnText = document.getElementById('excelBtnText');
            const csvBtnText = document.getElementById('csvBtnText');
            const loadingMessage = document.getElementById('loadingMessage');

            if (loaded) {
                excelBtn.disabled = false;
                csvBtn.disabled = false;
                excelBtnText.textContent = 'Download Excel';
                csvBtnText.textContent = 'Download CSV';
                loadingMessage.style.display = 'none';
                isLibraryLoaded = true;
            } else {
                excelBtn.disabled = true;
                csvBtn.disabled = true;
                excelBtnText.textContent = 'Loading...';
                csvBtnText.textContent = 'Loading...';
                loadingMessage.style.display = 'block';
            }
        }

        function downloadAsExcel() {
            if (!isLibraryLoaded) {
                alert('Excel library is still loading. Please wait.');
                return;
            }

            try {
                const table = document.getElementById('academicTable');
                const rows = table.querySelectorAll('tr');
                const data = [];
                
                rows.forEach(row => {
                    const cells = row.querySelectorAll('th, td');
                    const rowData = [];
                    cells.forEach(cell => {
                        let cellText = cell.textContent.trim();
                        cellText = cellText.replace(/<[^>]*>/g, '');
                        rowData.push(cellText);
                    });
                    if (rowData.length > 0) {
                        data.push(rowData);
                    }
                });
                
                if (data.length === 0) {
                    alert('No data found in table');
                    return;
                }
                
                const ws = XLSX.utils.aoa_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Academic Report");
                const wbout = XLSX.write(wb, {bookType: 'xlsx', type: 'array'});
                const base64 = btoa(String.fromCharCode.apply(null, wbout));
                const filename = '${examName.replace(/[^a-zA-Z0-9]/g, '_')}_${examCode}_Academic_Report.xlsx';
                
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'download',
                        format: 'excel',
                        data: base64,
                        filename: filename
                    }));
                } else {
                    const blob = new Blob([wbout], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } catch (error) {
                console.error('Excel download error:', error);
                alert('Error downloading Excel file: ' + error.message);
            }
        }

        function downloadAsCSV() {
            if (!isLibraryLoaded) {
                alert('Excel library is still loading. Please wait.');
                return;
            }

            try {
                const table = document.getElementById('academicTable');
                if (!table) {
                    alert('Table not found');
                    return;
                }
                
                const wb = XLSX.utils.table_to_book(table, {sheet: "Academic Report"});
                const csvOutput = XLSX.utils.sheet_to_csv(wb.Sheets["Academic Report"]);
                const base64 = btoa(unescape(encodeURIComponent(csvOutput)));
                const filename = '${examName.replace(/[^a-zA-Z0-9]/g, '_')}_${examCode}_Academic_Report.csv';
                
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'download',
                        format: 'csv',
                        data: base64,
                        filename: filename
                    }));
                } else {
                    const blob = new Blob([csvOutput], {type: 'text/csv'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } catch (error) {
                console.error('CSV download error:', error);
                alert('Error downloading CSV file: ' + error.message);
            }
        }

        function downloadAsPDF() {
            try {
                const filename = '${examName.replace(/[^a-zA-Z0-9]/g, '_')}_${examCode}_Academic_Report.pdf';
                const htmlContent = document.documentElement.outerHTML;
                const base64 = btoa(unescape(encodeURIComponent(htmlContent)));
                
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'download',
                        format: 'pdf',
                        data: base64,
                        filename: filename
                    }));
                } else {
                    window.print();
                }
            } catch (error) {
                console.error('PDF download error:', error);
                alert('Error downloading PDF file: ' + error.message);
            }
        }

        function checkLibrary() {
            let attempts = 0;
            const maxAttempts = 20;
            
            function check() {
                if (typeof XLSX !== 'undefined') {
                    console.log('XLSX library loaded successfully');
                    updateButtonStates(true);
                    return;
                }
                
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(check, 500);
                } else {
                    console.error('XLSX library failed to load');
                    document.getElementById('loadingMessage').textContent = 'Failed to load Excel library. Please refresh and try again.';
                }
            }
            
            check();
        }

        document.addEventListener('DOMContentLoaded', function() {
            updateButtonStates(false);
            checkLibrary();
        });

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                updateButtonStates(false);
                checkLibrary();
            });
        } else {
            updateButtonStates(false);
            checkLibrary();
        }
    </script>
</body>
</html>`;

    return html;
  };

  const generateAndOpenExcel = async (examId: string, examName: string, examCode: string) => {
    try {
      setGenerating(true);
      
      const html = generateExcelHTML(examId, examName, examCode);
      setCurrentExcelHTML(html);
      setCurrentExamName(`${examName} - Academic Report`);
      setWebViewVisible(true);

    } catch (error) {
      console.error('Generate Excel error:', error);
      Alert.alert('Error', 'Failed to generate Excel file');
    } finally {
      setGenerating(false);
    }
  };

  const renderExamCard = (examInfo: string, index: number) => {
    const [examId, examName, examCode] = examInfo.split('|');
    const studentsCount = studentsData.filter(student => 
      student.exams.some(exam => exam.examId === examId)
    ).length;

    return (
      <TouchableOpacity
        key={index}
        style={styles.examCard}
        onPress={() => generateAndOpenExcel(examId, examName, examCode)}
        disabled={generating}
        activeOpacity={0.7}
      >
        <View style={styles.examCardContent}>
          <View style={styles.examIconContainer}>
            <FontAwesome5 name="file-alt" size={24} color="#4299E1" />
          </View>
          
          <View style={styles.examInfo}>
            <Text style={styles.examName}>{examName}</Text>
            <Text style={styles.examCode}>Code: {examCode}</Text>
            <Text style={styles.studentsCount}>
              <FontAwesome5 name="users" size={12} color="#718096" /> {studentsCount} students
            </Text>
          </View>
          
          <View style={styles.examActionContainer}>
            {generating ? (
              <ActivityIndicator size="small" color="#4299E1" />
            ) : (
              <FontAwesome5 name="chevron-right" size={18} color="#CBD5E0" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4299E1" />
          <Text style={styles.loadingText}>Loading academic data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
      
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
      >
        {studentsData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="clipboard-list" size={64} color="#CBD5E0" />
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptySubtitle}>
              No student academic data found for this class
            </Text>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={onRefresh}
            >
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : availableExams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="file-alt" size={64} color="#CBD5E0" />
            <Text style={styles.emptyTitle}>No Exams Found</Text>
            <Text style={styles.emptySubtitle}>
              No exams have been created for this class yet
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
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Class Overview</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <View style={[styles.summaryIconContainer, { backgroundColor: '#EBF8FF' }]}>
                    <FontAwesome5 name="users" size={20} color="#4299E1" />
                  </View>
                  <Text style={styles.summaryNumber}>{studentsData.length}</Text>
                  <Text style={styles.summaryLabel}>Total Students</Text>
                </View>
                <View style={styles.summaryItem}>
                  <View style={[styles.summaryIconContainer, { backgroundColor: '#F0FFF4' }]}>
                    <FontAwesome5 name="clipboard-list" size={20} color="#38A169" />
                  </View>
                  <Text style={styles.summaryNumber}>{availableExams.length}</Text>
                  <Text style={styles.summaryLabel}>Available Exams</Text>
                </View>
              </View>
            </View>

            {generating && (
              <View style={styles.generatingCard}>
                <ActivityIndicator size="small" color="#4299E1" />
                <Text style={styles.generatingText}>Generating report...</Text>
              </View>
            )}

            {/* Exams List */}
            <View style={styles.examsSection}>
              <Text style={styles.sectionTitle}>Available Exam Reports</Text>
              <Text style={styles.sectionSubtitle}>
                Tap on any exam to generate and download the academic report
              </Text>
              {availableExams.map((examInfo, index) => renderExamCard(examInfo, index))}
            </View>
          </>
        )}
        </ScrollView>

      <Modal
        visible={webViewVisible}
        animationType="slide"
        onRequestClose={() => setWebViewVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setWebViewVisible(false)}
            >
              <FontAwesome5 name="times" size={20} color="#2D3748" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{currentExamName}</Text>
            <View style={{ width: 36 }} />
          </View>
          
          <WebView
            source={{ html: currentExcelHTML }}
            style={{ flex: 1 }}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={handleWebViewMessage}
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color="#4299E1" />
                <Text style={styles.loadingText}>Loading report...</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollView: {
    flex: 1,
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
    color: '#718096',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2D3748',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
  },
  refreshButton: {
    marginTop: 24,
    backgroundColor: '#4299E1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3748',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#718096',
    marginTop: 4,
    textAlign: 'center',
  },
  generatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BEE3F8',
  },
  generatingText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#2C5282',
    fontWeight: '500',
  },
  examsSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 16,
    lineHeight: 20,
  },
  examCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  examCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  examIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EBF8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  examInfo: {
    flex: 1,
  },
  examName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  examCode: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 6,
  },
  studentsCount: {
    fontSize: 13,
    color: '#4A5568',
  },
  examActionContainer: {
    paddingLeft: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default TeacherAdminStudentAcademicSheetScreen;