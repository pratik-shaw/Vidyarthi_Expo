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
} from 'react-native';
import { WebView } from 'react-native-webview';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

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

      // FIXED: Changed endpoint from /students to /complete-academic
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
        
        // Extract unique exams
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

  const generateExcelHTML = (examId: string, examName: string, examCode: string): string => {
  // Filter students data for the specific exam
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

  // FIXED: Get all unique subjects for this exam from the exam data itself
  const allSubjects = new Map<string, { subjectId: string; subjectName: string }>();
  
  examData.forEach(student => {
    if (student.exam) {
      student.exam.subjects.forEach(subject => {
        // Ensure we have valid subject data before adding
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

  // Add debugging log to check subjects
  console.log('Subjects for Excel generation:', subjects);
  console.log('Sample student exam data:', examData[0]?.exam?.subjects);

  // If no subjects found, return error message
  if (subjects.length === 0) {
    return '<html><body><h2>No valid subjects found for this exam</h2></body></html>';
  }

  // Calculate statistics
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
        }
        .download-btn:hover {
            background: #2c5282;
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
        .debug-info {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            font-size: 12px;
        }
        @media print {
            .download-section, .debug-info {
                display: none;
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

    <div class="debug-info">
        <strong>Debug Info:</strong> Found ${subjects.length} subjects for ${totalStudents} students
        <br>Subjects: ${subjects.map(s => s.subjectName).join(', ')}
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
        <button class="download-btn" onclick="window.print()">Print Report</button>
        <button class="download-btn" onclick="downloadAsExcel()">Download Excel</button>
        <button class="download-btn" onclick="downloadAsCSV()">Download CSV</button>
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
        function downloadAsExcel() {
            try {
                if (typeof XLSX === 'undefined') {
                    alert('Excel library not loaded. Please try again.');
                    return;
                }
                
                const table = document.getElementById('academicTable');
                if (!table) {
                    alert('Table not found');
                    return;
                }
                
                const wb = XLSX.utils.table_to_book(table, {sheet: "Academic Report"});
                const filename = '${examName.replace(/[^a-zA-Z0-9]/g, '_')}_${examCode}_Academic_Report.xlsx';
                XLSX.writeFile(wb, filename);
            } catch (error) {
                console.error('Excel download error:', error);
                alert('Error downloading Excel file: ' + error.message);
            }
        }

        function downloadAsCSV() {
            try {
                if (typeof XLSX === 'undefined') {
                    alert('Excel library not loaded. Please try again.');
                    return;
                }
                
                const table = document.getElementById('academicTable');
                if (!table) {
                    alert('Table not found');
                    return;
                }
                
                const wb = XLSX.utils.table_to_book(table, {sheet: "Academic Report"});
                const filename = '${examName.replace(/[^a-zA-Z0-9]/g, '_')}_${examCode}_Academic_Report.csv';
                XLSX.writeFile(wb, filename, {bookType: 'csv'});
            } catch (error) {
                console.error('CSV download error:', error);
                alert('Error downloading CSV file: ' + error.message);
            }
        }

        // Ensure XLSX library is loaded before enabling buttons
        document.addEventListener('DOMContentLoaded', function() {
            let attempts = 0;
            const maxAttempts = 10;
            
            function checkLibrary() {
                if (typeof XLSX !== 'undefined') {
                    console.log('XLSX library loaded successfully');
                    return;
                }
                
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(checkLibrary, 500);
                } else {
                    console.error('XLSX library failed to load');
                }
            }
            
            checkLibrary();
        });
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
      <View key={index} style={styles.examCard}>
        <View style={styles.examInfo}>
          <Text style={styles.examName}>{examName}</Text>
          <Text style={styles.examCode}>Code: {examCode}</Text>
          <Text style={styles.studentsCount}>{studentsCount} students</Text>
        </View>
        
        <TouchableOpacity
          style={styles.generateButton}
          onPress={() => generateAndOpenExcel(examId, examName, examCode)}
          disabled={generating}
        >
          <FontAwesome5 name="file-excel" size={16} color="white" />
          <Text style={styles.generateButtonText}>Generate Excel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>Loading students data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <FontAwesome5 name="arrow-left" size={20} color="#3182ce" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Academic Sheets</Text>
          <Text style={styles.headerSubtitle}>{className}</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <FontAwesome5 
            name="sync-alt" 
            size={18} 
            color="#3182ce" 
            style={refreshing ? { opacity: 0.5 } : {}}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {studentsData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="clipboard-list" size={48} color="#a0aec0" />
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>
              No student academic data found for this class
            </Text>
          </View>
        ) : availableExams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="file-alt" size={48} color="#a0aec0" />
            <Text style={styles.emptyTitle}>No Exams Found</Text>
            <Text style={styles.emptyText}>
              No exams have been created for this class yet
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Class Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{studentsData.length}</Text>
                  <Text style={styles.summaryLabel}>Total Students</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{availableExams.length}</Text>
                  <Text style={styles.summaryLabel}>Available Exams</Text>
                </View>
              </View>
            </View>

            {generating && (
              <View style={styles.generatingCard}>
                <ActivityIndicator size="small" color="#3182ce" />
                <Text style={styles.generatingText}>Generating Excel file...</Text>
              </View>
            )}

            <View style={styles.examsSection}>
              <Text style={styles.sectionTitle}>Available Exams</Text>
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
              <FontAwesome5 name="times" size={20} color="#3182ce" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{currentExamName}</Text>
          </View>
          
          <WebView
            source={{ html: currentExcelHTML }}
            style={{ flex: 1 }}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color="#3182ce" />
                <Text>Loading report...</Text>
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
    backgroundColor: '#f7fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#718096',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a5568',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3182ce',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
  },
  generatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ebf8ff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  generatingText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#3182ce',
  },
  examsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 15,
  },
  examCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examInfo: {
    flex: 1,
  },
  examName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  examCode: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
  },
  studentsCount: {
    fontSize: 14,
    color: '#4a5568',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38a169',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  generateButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f7fafc',
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginLeft: 15,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
});

export default TeacherAdminStudentAcademicSheetScreen;