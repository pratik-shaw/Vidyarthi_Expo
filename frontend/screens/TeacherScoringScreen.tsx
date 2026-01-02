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
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL} from '../config/api';

const { width } = Dimensions.get('window');


// API URL with configurable timeout
const API_URL = API_BASE_URL; // Change this to your server IP/domain
const API_TIMEOUT = 15000; // 15 seconds timeout


type TeacherScoringParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherScoring'>;

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
}

interface Student {
  studentId: string;
  studentName: string;
  studentNumber: string;
  exams: Exam[];
}

interface ScoringData {
  students: Student[];
  classInfo: {
    id: string;
    name: string;
    section: string;
  };
  teacherInfo: {
    id: string;
    name: string;
  };
  totalStudents: number;
}

interface MarkSubmission {
  studentId: string;
  studentName: string;
  examId: string;
  examName: string;
  subjectId: string;
  subjectName: string;
  fullMarks: number;
  currentMarks: number | null;
}

const TeacherScoringScreen: React.FC<Props> = ({ route, navigation }) => {
  const { classId, className } = route.params as unknown as TeacherScoringParams;
  
  const [scoringData, setScoringData] = useState<ScoringData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMark, setSelectedMark] = useState<MarkSubmission | null>(null);
  const [inputMarks, setInputMarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bulk update states
const [bulkModalVisible, setBulkModalVisible] = useState(false);
const [selectedBulkExam, setSelectedBulkExam] = useState<string>('');
const [selectedBulkSubject, setSelectedBulkSubject] = useState<string>('');
const [bulkMarks, setBulkMarks] = useState<{ [studentId: string]: string }>({});
const [bulkSubmitting, setBulkSubmitting] = useState(false);
  
  // Filter states
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `Scoring - ${className}`,
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#3A4276',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
    });
  }, [navigation, className]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
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
        fetchScoringData(storedToken);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data');
        setLoading(false);
      }
    };
    loadData();
  }, [classId]);

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

  const fetchScoringData = async (authToken = token) => {
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
      const response = await apiClient.get(`/marks/class/${classId}/students`);
      
      setScoringData(response.data);
      console.log('Scoring data fetched:', response.data);
    } catch (error) {
      console.error('Error fetching scoring data:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else if (error.response?.status === 403) {
          setError('You are not authorized to score students in this class');
        } else {
          setError(`Error: ${error.response?.data?.msg || 'Failed to fetch scoring data'}`);
        }
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchScoringData();
  };

  const openMarkingModal = (student: Student, exam: Exam, subject: Subject) => {
    const markSubmission: MarkSubmission = {
      studentId: student.studentId,
      studentName: student.studentName,
      examId: exam.examId,
      examName: exam.examName,
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      fullMarks: subject.fullMarks,
      currentMarks: subject.marksScored,
    };
    
    setSelectedMark(markSubmission);
    setInputMarks(subject.marksScored?.toString() || '');
    setModalVisible(true);
  };

  const submitMarks = async () => {
    if (!selectedMark || !token) return;
    
    const marks = parseFloat(inputMarks);
    
    if (isNaN(marks)) {
      Alert.alert('Invalid Input', 'Please enter a valid number');
      return;
    }
    
    if (marks < 0) {
      Alert.alert('Invalid Input', 'Marks cannot be negative');
      return;
    }
    
    if (marks > selectedMark.fullMarks) {
      Alert.alert('Invalid Input', `Marks cannot exceed ${selectedMark.fullMarks}`);
      return;
    }

    setSubmitting(true);
    
    try {
      const apiClient = getAuthenticatedClient();
      const response = await apiClient.post(
        `/marks/class/${classId}/student/${selectedMark.studentId}/exam/${selectedMark.examId}/subject/${selectedMark.subjectId}`,
        { marksScored: marks }
      );
      
      console.log('Marks submitted successfully:', response.data);
      
      Alert.alert(
        'Success',
        `Marks submitted successfully for ${selectedMark.studentName}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setModalVisible(false);
              fetchScoringData(); // Refresh data
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error submitting marks:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else {
          Alert.alert('Error', error.response?.data?.msg || 'Failed to submit marks');
        }
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openBulkMarkingModal = () => {
  if (uniqueExams.length === 0) {
    Alert.alert('No Exams', 'There are no exams available for bulk marking');
    return;
  }
  setBulkModalVisible(true);
  setSelectedBulkExam('');
  setSelectedBulkSubject('');
  setBulkMarks({});
};

const getBulkStudentsForSubject = () => {
  if (!scoringData || !selectedBulkExam || !selectedBulkSubject) return [];
  
  return scoringData.students
    .map(student => {
      const exam = student.exams.find(e => e.examId === selectedBulkExam);
      if (!exam) return null;
      
      const subject = exam.subjects.find(s => s.subjectId === selectedBulkSubject);
      if (!subject) return null;
      
      return {
        studentId: student.studentId,
        studentName: student.studentName,
        studentNumber: student.studentNumber,
        currentMarks: subject.marksScored,
        fullMarks: subject.fullMarks,
        subjectName: subject.subjectName,
        examName: exam.examName,
      };
    })
    .filter(item => item !== null);
};

const updateBulkMark = (studentId: string, marks: string) => {
  setBulkMarks(prev => ({
    ...prev,
    [studentId]: marks
  }));
};

const submitBulkMarks = async () => {
  if (!selectedBulkExam || !selectedBulkSubject || !token) return;
  
  const studentsToUpdate = Object.entries(bulkMarks).filter(([_, marks]) => marks.trim() !== '');
  
  if (studentsToUpdate.length === 0) {
    Alert.alert('No Marks Entered', 'Please enter marks for at least one student');
    return;
  }
  
  const bulkStudents = getBulkStudentsForSubject();
  const fullMarks = bulkStudents[0]?.fullMarks || 100;
  
  // Validate all marks
  for (const [studentId, marksStr] of studentsToUpdate) {
    const marks = parseFloat(marksStr);
    
    if (isNaN(marks)) {
      const student = bulkStudents.find(s => s.studentId === studentId);
      Alert.alert('Invalid Input', `Invalid marks for ${student?.studentName}`);
      return;
    }
    
    if (marks < 0) {
      const student = bulkStudents.find(s => s.studentId === studentId);
      Alert.alert('Invalid Input', `Marks cannot be negative for ${student?.studentName}`);
      return;
    }
    
    if (marks > fullMarks) {
      const student = bulkStudents.find(s => s.studentId === studentId);
      Alert.alert('Invalid Input', `Marks cannot exceed ${fullMarks} for ${student?.studentName}`);
      return;
    }
  }
  
  setBulkSubmitting(true);
  
  try {
    const apiClient = getAuthenticatedClient();
    let successCount = 0;
    let failCount = 0;
    
    // Submit marks for each student
    for (const [studentId, marksStr] of studentsToUpdate) {
      try {
        const marks = parseFloat(marksStr);
        await apiClient.post(
          `/marks/class/${classId}/student/${studentId}/exam/${selectedBulkExam}/subject/${selectedBulkSubject}`,
          { marksScored: marks }
        );
        successCount++;
      } catch (error) {
        console.error(`Error submitting marks for student ${studentId}:`, error);
        failCount++;
      }
    }
    
    Alert.alert(
      'Bulk Update Complete',
      `Successfully updated: ${successCount}\nFailed: ${failCount}`,
      [
        {
          text: 'OK',
          onPress: () => {
            setBulkModalVisible(false);
            setBulkMarks({});
            setSelectedBulkExam('');
            setSelectedBulkSubject('');
            fetchScoringData(); // Refresh data
          }
        }
      ]
    );
    
  } catch (error) {
    console.error('Error in bulk update:', error);
    Alert.alert('Error', 'Failed to complete bulk update');
  } finally {
    setBulkSubmitting(false);
  }
};

  const getFilteredStudents = () => {
    if (!scoringData) return [];
    
    return scoringData.students.map(student => ({
      ...student,
      exams: student.exams.filter(exam => {
        const examMatch = selectedExam === 'all' || exam.examId === selectedExam;
        const hasMatchingSubject = selectedSubject === 'all' || 
          exam.subjects.some(subject => subject.subjectId === selectedSubject);
        return examMatch && hasMatchingSubject;
      }).map(exam => ({
        ...exam,
        subjects: selectedSubject === 'all' ? exam.subjects : 
          exam.subjects.filter(subject => subject.subjectId === selectedSubject)
      })),
    })).filter(student => student.exams.length > 0);
  };

  const getUniqueExams = () => {
    if (!scoringData) return [];
    const exams = new Map();
    scoringData.students.forEach(student => {
      student.exams.forEach(exam => {
        if (!exams.has(exam.examId)) {
          exams.set(exam.examId, { id: exam.examId, name: exam.examName, code: exam.examCode });
        }
      });
    });
    return Array.from(exams.values());
  };

  const getUniqueSubjects = () => {
    if (!scoringData) return [];
    const subjects = new Map();
    scoringData.students.forEach(student => {
      student.exams.forEach(exam => {
        exam.subjects.forEach(subject => {
          if (!subjects.has(subject.subjectId)) {
            subjects.set(subject.subjectId, { id: subject.subjectId, name: subject.subjectName });
          }
        });
      });
    });
    return Array.from(subjects.values());
  };

  const renderSubjectCard = (student: Student, exam: Exam, subject: Subject) => {
    const isScored = subject.marksScored !== null;
    const percentage = isScored ? (subject.marksScored! / subject.fullMarks) * 100 : 0;
    
    return (
      <TouchableOpacity
        key={`${student.studentId}-${exam.examId}-${subject.subjectId}`}
        style={[styles.subjectCard, isScored && styles.scoredCard]}
        onPress={() => openMarkingModal(student, exam, subject)}
      >
        <View style={styles.subjectHeader}>
          <Text style={styles.subjectName}>{subject.subjectName}</Text>
          <View style={[styles.statusIndicator, { backgroundColor: isScored ? '#38EF7D' : '#FFB946' }]}>
            <Text style={styles.statusText}>{isScored ? 'Scored' : 'Pending'}</Text>
          </View>
        </View>
        
        <View style={styles.marksInfo}>
          <Text style={styles.marksText}>
            {isScored ? `${subject.marksScored}` : '--'} / {subject.fullMarks}
          </Text>
          {isScored && (
            <Text style={[styles.percentageText, { color: percentage >= 60 ? '#38EF7D' : '#F7685B' }]}>
              {percentage.toFixed(1)}%
            </Text>
          )}
        </View>
        
        <Text style={styles.examInfo}>{exam.examName} ({exam.examCode})</Text>
        
        {isScored && subject.scoredAt && (
          <Text style={styles.scoredDate}>
            Scored on {new Date(subject.scoredAt).toLocaleDateString()}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderStudentItem = ({ item: student }: { item: Student }) => {
    const allSubjects = student.exams.flatMap(exam => 
      exam.subjects.map(subject => ({ ...subject, exam }))
    );
    
    const scoredCount = allSubjects.filter(s => s.marksScored !== null).length;
    const totalCount = allSubjects.length;
    
    return (
      <View style={styles.studentContainer}>
        <View style={styles.studentHeader}>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{student.studentName}</Text>
            <Text style={styles.studentNumber}>ID: {student.studentNumber}</Text>
          </View>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>{scoredCount}/{totalCount}</Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: totalCount > 0 ? `${(scoredCount / totalCount) * 100}%` : '0%',
                    backgroundColor: scoredCount === totalCount ? '#38EF7D' : '#1CB5E0'
                  }
                ]} 
              />
            </View>
          </View>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectsScroll}>
          {student.exams.map(exam => 
            exam.subjects.map(subject => renderSubjectCard(student, exam, subject))
          )}
        </ScrollView>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar hidden={true} />
        <ActivityIndicator size="large" color="#1CB5E0" />
        <Text style={styles.loadingText}>Loading scoring data...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar hidden={true} />
        <FontAwesome5 name="exclamation-circle" size={48} color="#F7685B" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchScoringData()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const filteredStudents = getFilteredStudents();
  const uniqueExams = getUniqueExams();
  const uniqueSubjects = getUniqueSubjects();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={true} />
      
      {/* Header Stats */}
      <View style={styles.headerStats}>
        <LinearGradient
          colors={['#1CB5E0', '#38EF7D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.statsGradient}
        >
          <View style={styles.statsContent}>
            <View style={styles.statItem}>
              <FontAwesome5 name="user-graduate" size={20} color="#FFFFFF" />
              <Text style={styles.statNumber}>{scoringData?.totalStudents || 0}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <FontAwesome5 name="book-open" size={20} color="#FFFFFF" />
              <Text style={styles.statNumber}>{uniqueSubjects.length}</Text>
              <Text style={styles.statLabel}>Subjects</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <FontAwesome5 name="clipboard-list" size={20} color="#FFFFFF" />
              <Text style={styles.statNumber}>{uniqueExams.length}</Text>
              <Text style={styles.statLabel}>Exams</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Bulk Update Button */}
<View style={styles.bulkUpdateContainer}>
  <TouchableOpacity
    style={styles.bulkUpdateButton}
    onPress={openBulkMarkingModal}
  >
    <FontAwesome5 name="users" size={16} color="#FFFFFF" />
    <Text style={styles.bulkUpdateButtonText}>Bulk Update Marks</Text>
  </TouchableOpacity>
</View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterButton, selectedExam === 'all' && styles.activeFilter]}
            onPress={() => setSelectedExam('all')}
          >
            <Text style={[styles.filterText, selectedExam === 'all' && styles.activeFilterText]}>
              All Exams
            </Text>
          </TouchableOpacity>
          
          {uniqueExams.map(exam => (
            <TouchableOpacity
              key={exam.id}
              style={[styles.filterButton, selectedExam === exam.id && styles.activeFilter]}
              onPress={() => setSelectedExam(exam.id)}
            >
              <Text style={[styles.filterText, selectedExam === exam.id && styles.activeFilterText]}>
                {exam.code}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectFilters}>
          <TouchableOpacity
            style={[styles.filterButton, selectedSubject === 'all' && styles.activeFilter]}
            onPress={() => setSelectedSubject('all')}
          >
            <Text style={[styles.filterText, selectedSubject === 'all' && styles.activeFilterText]}>
              All Subjects
            </Text>
          </TouchableOpacity>
          
          {uniqueSubjects.map(subject => (
            <TouchableOpacity
              key={subject.id}
              style={[styles.filterButton, selectedSubject === subject.id && styles.activeFilter]}
              onPress={() => setSelectedSubject(subject.id)}
            >
              <Text style={[styles.filterText, selectedSubject === subject.id && styles.activeFilterText]}>
                {subject.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Students List */}
      <FlatList
        data={filteredStudents}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.studentId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1CB5E0', '#38EF7D']}
          />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="clipboard-list" size={48} color="#B0B7C3" />
            <Text style={styles.emptyText}>No students found for the selected filters</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters or check back later</Text>
          </View>
        }
      />

      {/* Marking Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Score Student</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#8A94A6" />
              </TouchableOpacity>
            </View>
            
            {selectedMark && (
              <>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalInfoText}>Student: {selectedMark.studentName}</Text>
                  <Text style={styles.modalInfoText}>Subject: {selectedMark.subjectName}</Text>
                  <Text style={styles.modalInfoText}>Exam: {selectedMark.examName}</Text>
                  <Text style={styles.modalInfoText}>Full Marks: {selectedMark.fullMarks}</Text>
                </View>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Marks Scored</Text>
                  <TextInput
                    style={styles.marksInput}
                    value={inputMarks}
                    onChangeText={setInputMarks}
                    placeholder="Enter marks"
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <Text style={styles.inputHint}>Enter marks out of {selectedMark.fullMarks}</Text>
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.submitButton, submitting && styles.disabledButton]}
                    onPress={submitMarks}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Bulk Marking Modal */}
<Modal
  animationType="slide"
  transparent={true}
  visible={bulkModalVisible}
  onRequestClose={() => setBulkModalVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View style={[styles.modalContent, styles.bulkModalContent]}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Bulk Score Students</Text>
        <TouchableOpacity onPress={() => setBulkModalVisible(false)}>
          <Ionicons name="close" size={24} color="#8A94A6" />
        </TouchableOpacity>
      </View>
      
      {/* Exam Selection */}
      <View style={styles.selectionContainer}>
        <Text style={styles.selectionLabel}>Select Exam</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {uniqueExams.map(exam => (
            <TouchableOpacity
              key={exam.id}
              style={[
                styles.selectionButton,
                selectedBulkExam === exam.id && styles.activeSelectionButton
              ]}
              onPress={() => {
                setSelectedBulkExam(exam.id);
                setSelectedBulkSubject('');
                setBulkMarks({});
              }}
            >
              <Text style={[
                styles.selectionButtonText,
                selectedBulkExam === exam.id && styles.activeSelectionButtonText
              ]}>
                {exam.code}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Subject Selection */}
      {selectedBulkExam && (
        <View style={styles.selectionContainer}>
          <Text style={styles.selectionLabel}>Select Subject</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {uniqueSubjects.map(subject => (
              <TouchableOpacity
                key={subject.id}
                style={[
                  styles.selectionButton,
                  selectedBulkSubject === subject.id && styles.activeSelectionButton
                ]}
                onPress={() => {
                  setSelectedBulkSubject(subject.id);
                  setBulkMarks({});
                }}
              >
                <Text style={[
                  styles.selectionButtonText,
                  selectedBulkSubject === subject.id && styles.activeSelectionButtonText
                ]}>
                  {subject.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {/* Students List for Marking */}
      {selectedBulkExam && selectedBulkSubject && (
        <ScrollView style={styles.bulkStudentsList}>
          <Text style={styles.bulkStudentsTitle}>
            Enter marks for students ({getBulkStudentsForSubject().length} students)
          </Text>
          {getBulkStudentsForSubject().map((student, index) => (
            <View key={student.studentId} style={styles.bulkStudentItem}>
              <View style={styles.bulkStudentInfo}>
                <Text style={styles.bulkStudentName}>
                  {index + 1}. {student.studentName}
                </Text>
                <Text style={styles.bulkStudentNumber}>ID: {student.studentNumber}</Text>
                {student.currentMarks !== null && (
                  <Text style={styles.currentMarksText}>
                    Current: {student.currentMarks}/{student.fullMarks}
                  </Text>
                )}
              </View>
              <TextInput
                style={styles.bulkMarksInput}
                value={bulkMarks[student.studentId] || ''}
                onChangeText={(text) => updateBulkMark(student.studentId, text)}
                placeholder={`/${student.fullMarks}`}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          ))}
        </ScrollView>
      )}
      
      {/* Action Buttons */}
      {selectedBulkExam && selectedBulkSubject && (
        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setBulkModalVisible(false);
              setBulkMarks({});
              setSelectedBulkExam('');
              setSelectedBulkSubject('');
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.submitButton, bulkSubmitting && styles.disabledButton]}
            onPress={submitBulkMarks}
            disabled={bulkSubmitting}
          >
            {bulkSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit All</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1CB5E0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerStats: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1CB5E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  statsGradient: {
    padding: 20,
  },
  statsContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  subjectFilters: {
    marginTop: 8,
  },
  filterButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFilter: {
    backgroundColor: '#1CB5E0',
    borderColor: '#1CB5E0',
  },
  filterText: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  studentContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  studentNumber: {
    fontSize: 14,
    color: '#8A94A6',
  },
  progressContainer: {
    alignItems: 'flex-end',
  },
  progressText: {
    fontSize: 12,
    color: '#8A94A6',
    marginBottom: 4,
  },
  progressBar: {
    width: 80,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  subjectsScroll: {
    marginTop: 8,
  },
  subjectCard: {
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: width * 0.7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scoredCard: {
    borderColor: '#38EF7D',
    backgroundColor: 'rgba(56, 239, 125, 0.05)',
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    flex: 1,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  marksInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  marksText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A4276',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  examInfo: {
    fontSize: 12,
    color: '#8A94A6',
    marginBottom: 4,
  },
  scoredDate: {
    fontSize: 10,
    color: '#B0B7C3',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8A94A6',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A4276',
  },
  modalInfo: {
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#3A4276',
    marginBottom: 4,
    },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
  },
  marksInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FC',
    textAlign: 'center',
  },
  inputHint: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 4,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A94A6',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#1CB5E0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#B0B7C3',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bulkUpdateContainer: {
  paddingHorizontal: 16,
  marginBottom: 16,
},
bulkUpdateButton: {
  backgroundColor: '#3A4276',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 12,
  paddingHorizontal: 20,
  borderRadius: 12,
  gap: 8,
  shadowColor: '#3A4276',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 3,
},
bulkUpdateButtonText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '600',
},
bulkModalContent: {
  maxHeight: '90%',
  height: 'auto',
},
selectionContainer: {
  marginBottom: 16,
},
selectionLabel: {
  fontSize: 14,
  fontWeight: '600',
  color: '#3A4276',
  marginBottom: 8,
},
selectionButton: {
  backgroundColor: '#F8F9FC',
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 8,
  marginRight: 8,
  borderWidth: 1,
  borderColor: '#E2E8F0',
},
activeSelectionButton: {
  backgroundColor: '#1CB5E0',
  borderColor: '#1CB5E0',
},
selectionButtonText: {
  fontSize: 14,
  color: '#8A94A6',
  fontWeight: '500',
},
activeSelectionButtonText: {
  color: '#FFFFFF',
},
bulkStudentsList: {
  maxHeight: 400,
  marginBottom: 16,
},
bulkStudentsTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#3A4276',
  marginBottom: 12,
},
bulkStudentItem: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 12,
  paddingHorizontal: 12,
  backgroundColor: '#F8F9FC',
  borderRadius: 8,
  marginBottom: 8,
},
bulkStudentInfo: {
  flex: 1,
},
bulkStudentName: {
  fontSize: 14,
  fontWeight: '600',
  color: '#3A4276',
  marginBottom: 2,
},
bulkStudentNumber: {
  fontSize: 12,
  color: '#8A94A6',
},
currentMarksText: {
  fontSize: 11,
  color: '#1CB5E0',
  marginTop: 2,
},
bulkMarksInput: {
  borderWidth: 1,
  borderColor: '#E2E8F0',
  borderRadius: 6,
  padding: 8,
  fontSize: 14,
  backgroundColor: '#FFFFFF',
  textAlign: 'center',
  minWidth: 60,
},
});

export default TeacherScoringScreen;