import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  FlatList
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

const API_URL = 'http://192.168.29.148:5000/api';
const API_TIMEOUT = 15000;

type Props = NativeStackScreenProps<RootStackParamList, 'AdminClasses'>;

interface ClassData {
  _id: string;
  name: string;
  section: string;
  schoolId: string;
  teacherIds: TeacherData[];
  studentIds: StudentData[];
  createdAt: string;
}

interface TeacherData {
  _id: string;
  name: string;
  email: string;
}

interface StudentData {
  _id: string;
  name: string;
  studentId: string;
  email?: string;
}

interface AdminData {
  _id: string;
  name: string;
  email: string;
  schoolCode: string;
  schoolId: string;
}

const AdminClassesScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  
  // Main data
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [allTeachers, setAllTeachers] = useState<TeacherData[]>([]);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  
  // UI State
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'teachers' | 'students'>('overview');
  
  // Modals
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [teacherModalVisible, setTeacherModalVisible] = useState(false);
  const [studentModalVisible, setStudentModalVisible] = useState(false);
  
  // Forms
  const [classForm, setClassForm] = useState({ name: '', section: '' });
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Header setup
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Class Management',
      headerTitleStyle: { color: '#2D3748', fontWeight: '600' },
      headerLeft: () => (
        <TouchableOpacity 
          style={{ marginLeft: 16 }}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#2D3748" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  // Initial data load
  useEffect(() => {
    const initializeData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          navigation.replace('RoleSelection');
          return;
        }
        await Promise.all([loadAdminData(), loadAllData()]);
      } catch (error) {
        console.error('Init error:', error);
        handleLogout();
      }
    };
    initializeData();
  }, []);

  // API client
  const getAuthenticatedClient = async () => {
    const token = await AsyncStorage.getItem('token');
    return axios.create({
      baseURL: API_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  };

  // Load admin data
  const loadAdminData = async () => {
    try {
      if (!isConnected) return;
      const apiClient = await getAuthenticatedClient();
      const response = await apiClient.get('/admin/profile');
      setAdminData(response.data);
    } catch (error) {
      console.error('Error loading admin data:', error);
      handleApiError(error);
    }
  };

  // Load all data
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      const apiClient = await getAuthenticatedClient();
      const [classesRes, teachersRes, studentsRes] = await Promise.all([
        apiClient.get('/admin/classes'),
        apiClient.get('/admin/teachers'),
        apiClient.get('/admin/students')
      ]);
      
      setClasses(classesRes.data);
      setAllTeachers(teachersRes.data);
      setAllStudents(studentsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
  }, []);

  // Class operations
  const openCreateClassModal = () => {
    setClassForm({ name: '', section: '' });
    setEditingClass(null);
    setClassModalVisible(true);
  };

  const openEditClassModal = (classData: ClassData) => {
    setClassForm({ name: classData.name, section: classData.section });
    setEditingClass(classData);
    setClassModalVisible(true);
  };

  const createOrUpdateClass = async () => {
    if (!classForm.name.trim()) {
      Alert.alert('Error', 'Class name is required');
      return;
    }

    try {
      setIsLoading(true);
      const apiClient = await getAuthenticatedClient();
      
      if (editingClass) {
        await apiClient.put(`/admin/classes/${editingClass._id}`, classForm);
      } else {
        await apiClient.post('/admin/classes', classForm);
      }
      
      Alert.alert('Success', `Class ${editingClass ? 'updated' : 'created'} successfully`);
      setClassModalVisible(false);
      await loadAllData();
    } catch (error) {
      console.error('Error with class operation:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteClass = (classId: string) => {
    Alert.alert(
      "Delete Class",
      "This will remove the class and all its associations. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              const apiClient = await getAuthenticatedClient();
              await apiClient.delete(`/admin/classes/${classId}`);
              Alert.alert('Success', 'Class deleted successfully');
              if (selectedClass?._id === classId) {
                setSelectedClass(null);
              }
              await loadAllData();
            } catch (error) {
              console.error('Error deleting class:', error);
              handleApiError(error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Teacher operations
  const openTeacherModal = (classData: ClassData) => {
    setSelectedClass(classData);
    setSelectedTeacherIds([]);
    setTeacherSearchQuery('');
    setTeacherModalVisible(true);
  };

  const assignTeachers = async () => {
    if (!selectedClass || selectedTeacherIds.length === 0) {
      Alert.alert('Error', 'Please select at least one teacher');
      return;
    }

    try {
      setIsLoading(true);
      const apiClient = await getAuthenticatedClient();
      await apiClient.post('/admin/classes/assign-teachers', {
        classId: selectedClass._id,
        teacherIds: selectedTeacherIds
      });
      
      Alert.alert('Success', `${selectedTeacherIds.length} teacher(s) assigned`);
      setTeacherModalVisible(false);
      await loadAllData();
    } catch (error) {
      console.error('Error assigning teachers:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeTeacherFromClass = (teacherId: string, classId: string) => {
    Alert.alert(
      "Remove Teacher",
      "Remove this teacher from the class?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              const apiClient = await getAuthenticatedClient();
              await apiClient.post('/admin/classes/remove-teacher', {
                classId,
                teacherId
              });
              Alert.alert('Success', 'Teacher removed from class');
              await loadAllData();
            } catch (error) {
              console.error('Error removing teacher:', error);
              handleApiError(error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Student operations
  const openStudentModal = (classData: ClassData) => {
    setSelectedClass(classData);
    setSelectedStudentIds([]);
    setStudentSearchQuery('');
    setStudentModalVisible(true);
  };

  const assignStudents = async () => {
    if (!selectedClass || selectedStudentIds.length === 0) {
      Alert.alert('Error', 'Please select at least one student');
      return;
    }

    try {
      setIsLoading(true);
      const apiClient = await getAuthenticatedClient();
      await apiClient.post('/admin/classes/assign-students', {
        classId: selectedClass._id,
        studentIds: selectedStudentIds
      });
      
      Alert.alert('Success', `${selectedStudentIds.length} student(s) assigned`);
      setStudentModalVisible(false);
      await loadAllData();
    } catch (error) {
      console.error('Error assigning students:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeStudentFromClass = (studentId: string, classId: string) => {
    Alert.alert(
      "Remove Student",
      "Remove this student from the class?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              const apiClient = await getAuthenticatedClient();
              await apiClient.post('/admin/classes/remove-student', {
                classId,
                studentId
              });
              Alert.alert('Success', 'Student removed from class');
              await loadAllData();
            } catch (error) {
              console.error('Error removing student:', error);
              handleApiError(error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Utility functions
  const handleApiError = (error: any) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      Alert.alert("Session Expired", "Please login again.", [
        { text: "OK", onPress: () => handleLogout() }
      ]);
    } else {
      Alert.alert("Error", error.response?.data?.msg || "An error occurred");
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['token', 'userRole', 'adminData']);
      navigation.replace('RoleSelection');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Filter functions
  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.section.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAvailableTeachers = () => {
    if (!selectedClass) return [];
    const assignedTeacherIds = selectedClass.teacherIds.map(t => t._id);
    return allTeachers.filter(teacher => !assignedTeacherIds.includes(teacher._id));
  };

  const getAvailableStudents = () => {
    if (!selectedClass) return [];
    const assignedStudentIds = selectedClass.studentIds.map(s => s._id);
    return allStudents.filter(student => !assignedStudentIds.includes(student._id));
  };

  const filteredAvailableTeachers = getAvailableTeachers().filter(teacher =>
    teacher.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
    teacher.email.toLowerCase().includes(teacherSearchQuery.toLowerCase())
  );

  const filteredAvailableStudents = getAvailableStudents().filter(student =>
    student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
    student.studentId.toLowerCase().includes(studentSearchQuery.toLowerCase())
  );

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7FAFC" />
        <ActivityIndicator size="large" color="#4299E1" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const renderClassItem = ({ item }: { item: ClassData }) => (
    <View style={styles.classCard}>
      <TouchableOpacity 
        style={[styles.classHeader, selectedClass?._id === item._id && styles.selectedClassHeader]}
        onPress={() => setSelectedClass(selectedClass?._id === item._id ? null : item)}
      >
        <View style={styles.classInfo}>
          <Text style={styles.className}>{item.name}</Text>
          <Text style={styles.classSection}>Section: {item.section || 'N/A'}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>{item.teacherIds?.length || 0} Teachers</Text>
            <Text style={styles.statText}>{item.studentIds?.length || 0} Students</Text>
          </View>
        </View>
        
        <View style={styles.classActions}>
          <TouchableOpacity onPress={() => openEditClassModal(item)} style={styles.actionBtn}>
            <Feather name="edit-2" size={16} color="#4299E1" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteClass(item._id)} style={styles.actionBtn}>
            <Feather name="trash-2" size={16} color="#E53E3E" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {selectedClass?._id === item._id && (
        <View style={styles.classDetails}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
              onPress={() => setActiveTab('overview')}
            >
              <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'teachers' && styles.activeTab]}
              onPress={() => setActiveTab('teachers')}
            >
              <Text style={[styles.tabText, activeTab === 'teachers' && styles.activeTabText]}>
                Teachers ({item.teacherIds?.length || 0})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'students' && styles.activeTab]}
              onPress={() => setActiveTab('students')}
            >
              <Text style={[styles.tabText, activeTab === 'students' && styles.activeTabText]}>
                Students ({item.studentIds?.length || 0})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabContent}>
            {activeTab === 'overview' && (
              <View style={styles.overviewContent}>
                <Text style={styles.overviewText}>Class: {item.name}</Text>
                <Text style={styles.overviewText}>Section: {item.section || 'N/A'}</Text>
                <Text style={styles.overviewText}>
                  Created: {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            )}

            {activeTab === 'teachers' && (
              <View style={styles.listContent}>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => openTeacherModal(item)}
                >
                  <Feather name="plus" size={16} color="#4299E1" />
                  <Text style={styles.addButtonText}>Add Teachers</Text>
                </TouchableOpacity>
                
                {item.teacherIds?.map((teacher) => (
                  <View key={teacher._id} style={styles.memberItem}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{teacher.name}</Text>
                      <Text style={styles.memberDetail}>{teacher.email}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeTeacherFromClass(teacher._id, item._id)}
                      style={styles.removeBtn}
                    >
                      <Feather name="x" size={16} color="#E53E3E" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {activeTab === 'students' && (
              <View style={styles.listContent}>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => openStudentModal(item)}
                >
                  <Feather name="plus" size={16} color="#4299E1" />
                  <Text style={styles.addButtonText}>Add Students</Text>
                </TouchableOpacity>
                
                {item.studentIds?.map((student) => (
                  <View key={student._id} style={styles.memberItem}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{student.name}</Text>
                      <Text style={styles.memberDetail}>ID: {student.studentId}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeStudentFromClass(student._id, item._id)}
                      style={styles.removeBtn}
                    >
                      <Feather name="x" size={16} color="#E53E3E" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7FAFC" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.schoolCode}>School: {adminData?.schoolCode || 'N/A'}</Text>
        
        <View style={styles.searchContainer}>
          <Feather name="search" size={16} color="#718096" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search classes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#A0AEC0"
          />
        </View>
        
        <TouchableOpacity
          style={styles.createButton}
          onPress={openCreateClassModal}
        >
          <Feather name="plus" size={16} color="#FFF" />
          <Text style={styles.createButtonText}>Create Class</Text>
        </TouchableOpacity>
      </View>

      {/* Classes List */}
      {classes.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="book" size={48} color="#CBD5E0" />
          <Text style={styles.emptyText}>No classes found</Text>
          <Text style={styles.emptySubText}>Create your first class to get started</Text>
        </View>
      ) : (
        <FlatList
          data={filteredClasses}
          keyExtractor={(item) => item._id}
          renderItem={renderClassItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4299E1"]} />
          }
        />
      )}

      {/* Class Modal */}
      <Modal visible={classModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingClass ? 'Edit Class' : 'Create Class'}
              </Text>
              <TouchableOpacity onPress={() => setClassModalVisible(false)}>
                <Feather name="x" size={24} color="#2D3748" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Class Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter class name"
                value={classForm.name}
                onChangeText={(text) => setClassForm(prev => ({ ...prev, name: text }))}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Section</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter section"
                value={classForm.section}
                onChangeText={(text) => setClassForm(prev => ({ ...prev, section: text }))}
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setClassModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={createOrUpdateClass}
              >
                <Text style={styles.saveButtonText}>
                  {editingClass ? 'Update' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Teacher Assignment Modal */}
      <Modal visible={teacherModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.largeModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Teachers</Text>
              <TouchableOpacity onPress={() => setTeacherModalVisible(false)}>
                <Feather name="x" size={24} color="#2D3748" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Feather name="search" size={16} color="#718096" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search available teachers..."
                value={teacherSearchQuery}
                onChangeText={setTeacherSearchQuery}
                placeholderTextColor="#A0AEC0"
              />
            </View>
            
            <Text style={styles.sectionTitle}>
              Available Teachers ({filteredAvailableTeachers.length})
            </Text>
            
            <ScrollView style={styles.membersList}>
              {filteredAvailableTeachers.map((teacher) => (
                <TouchableOpacity
                  key={teacher._id}
                  style={[
                    styles.selectableItem,
                    selectedTeacherIds.includes(teacher._id) && styles.selectedItem
                  ]}
                  onPress={() => {
                    setSelectedTeacherIds(prev =>
                      prev.includes(teacher._id)
                        ? prev.filter(id => id !== teacher._id)
                        : [...prev, teacher._id]
                    );
                  }}
                >
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{teacher.name}</Text>
                    <Text style={styles.memberDetail}>{teacher.email}</Text>
                  </View>
                  <View style={styles.checkbox}>
                    {selectedTeacherIds.includes(teacher._id) && (
                      <Feather name="check" size={16} color="#4299E1" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setTeacherModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  selectedTeacherIds.length === 0 && styles.disabledButton
                ]}
                onPress={assignTeachers}
                disabled={selectedTeacherIds.length === 0}
              >
                <Text style={styles.saveButtonText}>
                  Assign ({selectedTeacherIds.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Student Assignment Modal */}
      <Modal visible={studentModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.largeModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Students</Text>
              <TouchableOpacity onPress={() => setStudentModalVisible(false)}>
                <Feather name="x" size={24} color="#2D3748" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Feather name="search" size={16} color="#718096" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search available students..."
                value={studentSearchQuery}
                onChangeText={setStudentSearchQuery}
                placeholderTextColor="#A0AEC0"
              />
            </View>
            
            <Text style={styles.sectionTitle}>
              Available Students ({filteredAvailableStudents.length})
            </Text>
            
            <ScrollView style={styles.membersList}>
              {filteredAvailableStudents.map((student) => (
                <TouchableOpacity
                  key={student._id}
                  style={[
                    styles.selectableItem,
                    selectedStudentIds.includes(student._id) && styles.selectedItem
                  ]}
                  onPress={() => {
                    setSelectedStudentIds(prev =>
                      prev.includes(student._id)
                        ? prev.filter(id => id !== student._id)
                        : [...prev, student._id]
                    );
                  }}
                >
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{student.name}</Text>
                    <Text style={styles.memberDetail}>ID: {student.studentId}</Text>
                  </View>
                  <View style={styles.checkbox}>
                    {selectedStudentIds.includes(student._id) && (
                      <Feather name="check" size={16} color="#4299E1" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setStudentModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  selectedStudentIds.length === 0 && styles.disabledButton
                ]}
                onPress={assignStudents}
                disabled={selectedStudentIds.length === 0}
              >
                <Text style={styles.saveButtonText}>
                  Assign ({selectedStudentIds.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginTop: 12,
    fontSize: 16,
    color: '#2D3748',
  },
  header: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  schoolCode: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#2D3748',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4299E1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  listContainer: {
    padding: 16,
  },
  classCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  selectedClassHeader: {
    backgroundColor: '#EBF8FF',
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  classSection: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statText: {
    fontSize: 12,
    color: '#4A5568',
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  classActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F7FAFC',
  },
  classDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4299E1',
  },
  tabText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4299E1',
  },
  tabContent: {
    padding: 16,
  },
  overviewContent: {
    gap: 8,
  },
  overviewText: {
    fontSize: 14,
    color: '#4A5568',
  },
  listContent: {
    gap: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BEE3F8',
    borderStyle: 'dashed',
  },
  addButtonText: {
    color: '#4299E1',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D3748',
    marginBottom: 2,
  },
  memberDetail: {
    fontSize: 12,
    color: '#718096',
  },
  removeBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#FED7D7',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#4A5568',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  largeModal: {
    width: '95%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D3748',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A5568',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#2D3748',
    backgroundColor: '#FFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#4A5568',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4299E1',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#CBD5E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
    marginTop: 16,
  },
  membersList: {
    maxHeight: 300,
  },
  selectableItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedItem: {
    backgroundColor: '#EBF8FF',
    borderColor: '#4299E1',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AdminClassesScreen;