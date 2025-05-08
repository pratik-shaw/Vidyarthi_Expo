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
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

// API URL with configurable timeout
const API_URL = 'http://192.168.29.148:5000/api'; // Change this to your server IP/domain
const API_TIMEOUT = 15000; // 15 seconds timeout

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

interface AdminData {
  _id: string;
  name: string;
  email: string;
  schoolCode: string;
  schoolId: string;
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
}

interface FormData {
  name: string;
  section: string;
}

const AdminClassesScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [formData, setFormData] = useState<FormData>({ name: '', section: '' });
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [teacherModalVisible, setTeacherModalVisible] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Set header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Manage Classes',
      headerTitleStyle: {
        color: '#3A4276',
        fontWeight: '600',
      },
      headerLeft: () => (
        <TouchableOpacity 
          style={{ marginLeft: 16 }}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#3A4276" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Load data on initial render
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          // Not authenticated, redirect to role selection
          navigation.replace('RoleSelection');
          return;
        }

        // Load admin data and classes
        await loadAdminData();
        await loadClasses();
        await loadTeachers();
      } catch (error) {
        console.error('Auth check error:', error);
        handleLogout();
      }
    };

    checkAuthAndLoadData();
  }, [navigation]);

  // Create axios instance with auth token
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

  // Load admin data from API
  const loadAdminData = async () => {
    try {
      // Check if we have a cached version of the admin data
      const cachedAdminData = await AsyncStorage.getItem('adminData');
      if (cachedAdminData) {
        setAdminData(JSON.parse(cachedAdminData));
      }

      if (!isConnected) {
        return;
      }

      const apiClient = await getAuthenticatedClient();
      
      // Load admin profile
      const profileResponse = await apiClient.get('/admin/profile');
      const adminProfile = profileResponse.data;
      setAdminData(adminProfile);
      await AsyncStorage.setItem('adminData', JSON.stringify(adminProfile));
      
    } catch (error) {
      console.error('Error loading admin data:', error);
      handleApiError(error);
    }
  };

  // Load classes from API
  const loadClasses = async () => {
    setIsLoading(true);
    try {
      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      const apiClient = await getAuthenticatedClient();
      
      // Load classes data
      const classesResponse = await apiClient.get('/admin/classes');
      setClasses(classesResponse.data);
      
    } catch (error) {
      console.error('Error loading classes data:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Load teachers from API
  const loadTeachers = async () => {
    try {
      if (!isConnected) {
        return;
      }

      const apiClient = await getAuthenticatedClient();
      
      // Load teachers data
      const teachersResponse = await apiClient.get('/admin/teachers');
      setTeachers(teachersResponse.data);
      
    } catch (error) {
      console.error('Error loading teachers data:', error);
      handleApiError(error);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadClasses();
    await loadTeachers();
  }, []);

  // Handle form input changes
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({ name: '', section: '' });
    setEditingClass(null);
  };

  // Open modal for creating a new class
  const openCreateModal = () => {
    resetForm();
    setModalVisible(true);
    setIsCreating(true);
  };

  // Open modal for editing a class
  const openEditModal = (classData: ClassData) => {
    setFormData({
      name: classData.name,
      section: classData.section,
    });
    setEditingClass(classData);
    setModalVisible(true);
    setIsCreating(false);
  };

  // Open modal for assigning teacher
  const openAssignTeacherModal = (classId: string) => {
    setSelectedClassId(classId);
    setTeacherModalVisible(true);
  };

  // Create new class
  const createClass = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Class name is required');
      return;
    }

    try {
      setIsLoading(true);
      const apiClient = await getAuthenticatedClient();
      
      await apiClient.post('/admin/classes', formData);
      
      Alert.alert('Success', 'Class created successfully');
      setModalVisible(false);
      resetForm();
      await loadClasses();
    } catch (error) {
      console.error('Error creating class:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update class
  const updateClass = async () => {
    if (!formData.name.trim() || !editingClass?._id) {
      Alert.alert('Validation Error', 'Class name is required');
      return;
    }

    try {
      setIsLoading(true);
      const apiClient = await getAuthenticatedClient();
      
      await apiClient.put(`/admin/classes/${editingClass._id}`, formData);
      
      Alert.alert('Success', 'Class updated successfully');
      setModalVisible(false);
      resetForm();
      await loadClasses();
    } catch (error) {
      console.error('Error updating class:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete class
  const deleteClass = async (classId: string) => {
    Alert.alert(
      "Delete Class",
      "Are you sure you want to delete this class? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              const apiClient = await getAuthenticatedClient();
              
              await apiClient.delete(`/admin/classes/${classId}`);
              
              Alert.alert('Success', 'Class deleted successfully');
              await loadClasses();
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

  // Assign teacher to class
  const assignTeacher = async () => {
    if (!selectedClassId || !selectedTeacherId) {
      Alert.alert('Validation Error', 'Please select a teacher');
      return;
    }

    try {
      setIsLoading(true);
      const apiClient = await getAuthenticatedClient();
      
      await apiClient.post('/admin/classes/assign-teacher', {
        classId: selectedClassId,
        teacherId: selectedTeacherId
      });
      
      Alert.alert('Success', 'Teacher assigned successfully');
      setTeacherModalVisible(false);
      setSelectedClassId(null);
      setSelectedTeacherId(null);
      await loadClasses();
    } catch (error) {
      console.error('Error assigning teacher:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle API errors
  const handleApiError = (error: any) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Unauthorized, token might be expired
      Alert.alert(
        "Session Expired",
        "Your session has expired. Please login again.",
        [{ text: "OK", onPress: () => handleLogout() }]
      );
    } else {
      Alert.alert(
        "Error",
        error.response?.data?.msg || "An unexpected error occurred"
      );
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      // Clear auth data
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('adminData');
      
      // Navigate to role selection
      navigation.replace('RoleSelection');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  };

  // View class details
  const viewClassDetails = (classId: string) => {
    // You'll need to create this screen
    Alert.alert("Coming Soon", "Class details screen is under development.");
    // navigation.navigate('ClassDetails', { classId });
  };

  // Filter classes based on search query
  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.section.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show loading indicator
  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        <ActivityIndicator size="large" color="#4E54C8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      <View style={styles.container}>
        {/* School Info */}
        <View style={styles.schoolInfoContainer}>
          <View style={styles.schoolIconContainer}>
            <FontAwesome5 name="school" size={16} color="#4E54C8" />
          </View>
          <Text style={styles.schoolCodeText}>
            School Code: {adminData?.schoolCode || 'N/A'}
          </Text>
        </View>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#8A94A6" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search classes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8A94A6"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={20} color="#8A94A6" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        {/* Add Class Button */}
        <TouchableOpacity 
          style={styles.addButton}
          onPress={openCreateModal}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Create New Class</Text>
        </TouchableOpacity>
        
        {/* Classes List */}
        {classes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="book" size={50} color="#D1D5DB" />
            <Text style={styles.emptyText}>No classes found</Text>
            <Text style={styles.emptySubText}>Create your first class to get started</Text>
          </View>
        ) : (
          <FlatList
            data={filteredClasses}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#4E54C8"]}
              />
            }
            renderItem={({ item }) => (
              <View style={styles.classCard}>
                <TouchableOpacity 
                  style={styles.classCardContent}
                  onPress={() => viewClassDetails(item._id)}
                >
                  <View style={styles.classIconContainer}>
                    <Ionicons name="book" size={24} color="#4E54C8" />
                  </View>
                  
                  <View style={styles.classInfo}>
                    <Text style={styles.className}>{item.name}</Text>
                    <Text style={styles.classSection}>Section: {item.section || 'N/A'}</Text>
                    <View style={styles.classStats}>
                      <View style={styles.statItem}>
                        <FontAwesome5 name="chalkboard-teacher" size={12} color="#8A94A6" />
                        <Text style={styles.statText}>{item.teacherIds?.length || 0} Teachers</Text>
                      </View>
                      <View style={styles.statItem}>
                        <FontAwesome5 name="user-graduate" size={12} color="#8A94A6" />
                        <Text style={styles.statText}>{item.studentIds?.length || 0} Students</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                
                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.assignButton]}
                    onPress={() => openAssignTeacherModal(item._id)}
                  >
                    <FontAwesome5 name="user-plus" size={16} color="#4E54C8" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => openEditModal(item)}
                  >
                    <Feather name="edit-2" size={16} color="#FFA502" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => deleteClass(item._id)}
                  >
                    <Feather name="trash-2" size={16} color="#FF4757" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
      
      {/* Add/Edit Class Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isCreating ? 'Create New Class' : 'Update Class'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#3A4276" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Class Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter class name"
                value={formData.name}
                onChangeText={(text) => handleInputChange('name', text)}
                placeholderTextColor="#8A94A6"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Section</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter section (e.g. A, B, C)"
                value={formData.section}
                onChangeText={(text) => handleInputChange('section', text)}
                placeholderTextColor="#8A94A6"
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={isCreating ? createClass : updateClass}
              >
                <Text style={styles.saveButtonText}>
                  {isCreating ? 'Create' : 'Update'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Assign Teacher Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={teacherModalVisible}
        onRequestClose={() => setTeacherModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Teacher</Text>
              <TouchableOpacity onPress={() => setTeacherModalVisible(false)}>
                <Feather name="x" size={24} color="#3A4276" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>Select a teacher to assign to this class</Text>
            
            {teachers.length === 0 ? (
              <View style={styles.emptyTeachers}>
                <Text style={styles.emptyTeachersText}>No teachers available</Text>
              </View>
            ) : (
              <ScrollView style={styles.teachersList}>
                {teachers.map((teacher) => (
                  <TouchableOpacity
                    key={teacher._id}
                    style={[
                      styles.teacherItem,
                      selectedTeacherId === teacher._id && styles.selectedTeacher
                    ]}
                    onPress={() => setSelectedTeacherId(teacher._id)}
                  >
                    <View style={styles.teacherAvatar}>
                      <FontAwesome5 name="user" size={16} color="#4E54C8" />
                    </View>
                    <View style={styles.teacherInfo}>
                      <Text style={styles.teacherName}>{teacher.name}</Text>
                      <Text style={styles.teacherEmail}>{teacher.email}</Text>
                    </View>
                    {selectedTeacherId === teacher._id && (
                      <Ionicons name="checkmark-circle" size={24} color="#4E54C8" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setTeacherModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={assignTeacher}
                disabled={!selectedTeacherId}
              >
                <Text style={styles.saveButtonText}>Assign</Text>
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
    container: {
      flex: 1,
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F8F9FC',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: '#3A4276',
    },
    schoolInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    schoolIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(78, 84, 200, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    schoolCodeText: {
      fontSize: 14,
      color: '#3A4276',
      fontWeight: '500',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      paddingHorizontal: 12,
      marginBottom: 16,
      height: 48,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: '#3A4276',
      height: '100%',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#4E54C8',
      borderRadius: 8,
      paddingVertical: 12,
      marginBottom: 16,
      shadowColor: '#4E54C8',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    addButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#3A4276',
      marginTop: 16,
    },
    emptySubText: {
      fontSize: 14,
      color: '#8A94A6',
      marginTop: 8,
      textAlign: 'center',
    },
    listContent: {
      paddingBottom: 20,
    },
    classCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 3,
      overflow: 'hidden',
    },
    classCardContent: {
      flexDirection: 'row',
      padding: 16,
    },
    classIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(78, 84, 200, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    classInfo: {
      flex: 1,
    },
    className: {
      fontSize: 16,
      fontWeight: '600',
      color: '#3A4276',
      marginBottom: 4,
    },
    classSection: {
      fontSize: 14,
      color: '#8A94A6',
      marginBottom: 8,
    },
    classStats: {
      flexDirection: 'row',
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 16,
    },
    statText: {
      fontSize: 12,
      color: '#8A94A6',
      marginLeft: 4,
    },
    cardActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: '#F0F2F8',
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    assignButton: {
      borderRightWidth: 1,
      borderRightColor: '#F0F2F8',
    },
    editButton: {
      borderRightWidth: 1,
      borderRightColor: '#F0F2F8',
    },
    deleteButton: {},
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      width: '100%',
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 5,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#3A4276',
    },
    modalSubtitle: {
      fontSize: 14,
      color: '#8A94A6',
      marginBottom: 16,
    },
    formGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      color: '#3A4276',
      marginBottom: 8,
      fontWeight: '500',
    },
    input: {
      backgroundColor: '#F8F9FC',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: '#3A4276',
      borderWidth: 1,
      borderColor: '#E4E7ED',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 20,
    },
    modalButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    cancelButton: {
      backgroundColor: '#F0F2F8',
    },
    cancelButtonText: {
      color: '#3A4276',
      fontSize: 16,
      fontWeight: '500',
    },
    saveButton: {
      backgroundColor: '#4E54C8',
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '500',
    },
    teachersList: {
      maxHeight: 300,
    },
    teacherItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: '#F8F9FC',
    },
    selectedTeacher: {
      backgroundColor: 'rgba(78, 84, 200, 0.1)',
      borderWidth: 1,
      borderColor: '#4E54C8',
    },
    teacherAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(78, 84, 200, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    teacherInfo: {
      flex: 1,
    },
    teacherName: {
      fontSize: 14,
      fontWeight: '600',
      color: '#3A4276',
      marginBottom: 2,
    },
    teacherEmail: {
      fontSize: 12,
      color: '#8A94A6',
    },
    emptyTeachers: {
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTeachersText: {
      fontSize: 14,
      color: '#8A94A6',
      textAlign: 'center',
    }
  });

  export default AdminClassesScreen;