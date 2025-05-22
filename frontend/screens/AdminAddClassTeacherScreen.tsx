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

type Props = NativeStackScreenProps<RootStackParamList, 'AdminAddClassTeacher'>;

interface ClassData {
  _id: string;
  name: string;
  section: string;
  schoolId: string;
  teacherIds: TeacherData[];
  classAdmin?: TeacherData | string;
  classAdminId?: string;
  studentIds: StudentData[];
  createdAt: string;
}

interface TeacherData {
  _id: string;
  name: string;
  email: string;
  isClassAdmin?: boolean;
  assignedClasses?: string[];
  adminClassId?: string | null;
  classIds?: string[];
}

interface StudentData {
  _id: string;
  name: string;
  studentId: string;
}

interface AdminData {
  _id: string;
  name: string;
  email: string;
  schoolCode: string;
  schoolId: string;
  createdAt: string;
}

interface ClassAdminAssignment {
  classId: string;
  className: string;
  classSection: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  assignedAt: string;
  studentCount: number;
  teacherCount: number;
  status: 'active' | 'pending' | 'inactive';
}

const AdminAddClassTeacherScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [classAdmins, setClassAdmins] = useState<ClassAdminAssignment[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'assignments' | 'assign'>('assignments');
  const [isAssigning, setIsAssigning] = useState(false);

  // Set header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Class Administrators',
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
          navigation.replace('RoleSelection');
          return;
        }

        await loadAdminData();
        await loadClasses();
        await loadTeachers();
        await loadClassAdmins();
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
      const cachedAdminData = await AsyncStorage.getItem('adminData');
      if (cachedAdminData) {
        setAdminData(JSON.parse(cachedAdminData));
      }

      if (!isConnected) {
        return;
      }

      const apiClient = await getAuthenticatedClient();
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
    try {
      if (!isConnected) {
        return;
      }

      const apiClient = await getAuthenticatedClient();
      const classesResponse = await apiClient.get('/admin/classes');
      setClasses(classesResponse.data);
    } catch (error) {
      console.error('Error loading classes data:', error);
      handleApiError(error);
    }
  };

  // Load teachers from API
  const loadTeachers = async () => {
    try {
      if (!isConnected) {
        return;
      }

      const apiClient = await getAuthenticatedClient();
      const teachersResponse = await apiClient.get('/admin/teachers');
      setTeachers(teachersResponse.data);
    } catch (error) {
      console.error('Error loading teachers data:', error);
      handleApiError(error);
    }
  };

  // Fixed load class admin assignments
  const loadClassAdmins = async () => {
    setIsLoading(true);
    try {
      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      const apiClient = await getAuthenticatedClient();
      
      // Try to get class admin assignments from a dedicated endpoint first
      try {
        const classAdminsResponse = await apiClient.get('/admin/class-admins');
        console.log('Class admins from dedicated endpoint:', classAdminsResponse.data);
        
        if (classAdminsResponse.data && Array.isArray(classAdminsResponse.data)) {
          setClassAdmins(classAdminsResponse.data);
          setIsLoading(false);
          setRefreshing(false);
          return;
        }
      } catch (endpointError) {
        console.log('Dedicated endpoint not available, using fallback method');
      }
      
      // Fallback: Get all data and process
      const [classesResponse, teachersResponse] = await Promise.all([
        apiClient.get('/admin/classes'),
        apiClient.get('/admin/teachers')
      ]);
      
      const classesData = classesResponse.data;
      const teachersData = teachersResponse.data;
      
      console.log('Classes data:', classesData);
      console.log('Teachers data:', teachersData);
      
      // Create a map of teachers for quick lookup
      const teachersMap = new Map();
      teachersData.forEach((teacher: TeacherData) => {
        teachersMap.set(teacher._id, teacher);
      });
      
      // Process class admin assignments using multiple strategies
      const assignments: ClassAdminAssignment[] = [];
      
      // Strategy 1: Check teachers with adminClassId field
      teachersData.forEach((teacher: TeacherData) => {
        if (teacher.adminClassId && teacher.adminClassId !== null) {
          const assignedClass = classesData.find((cls: ClassData) => cls._id === teacher.adminClassId);
          if (assignedClass) {
            console.log('Found class admin via adminClassId:', teacher.name, 'for class:', assignedClass.name);
            
            assignments.push({
              classId: assignedClass._id,
              className: assignedClass.name,
              classSection: assignedClass.section || 'N/A',
              teacherId: teacher._id,
              teacherName: teacher.name,
              teacherEmail: teacher.email,
              assignedAt: assignedClass.createdAt,
              studentCount: assignedClass.studentIds?.length || 0,
              teacherCount: assignedClass.teacherIds?.length || 0,
              status: 'active',
            });
          }
        }
      });
      
      // Strategy 2: Check classes with classAdmin or classAdminId fields
      classesData.forEach((classItem: ClassData) => {
        // Skip if we already found an admin for this class
        if (assignments.some(admin => admin.classId === classItem._id)) {
          return;
        }
        
        let classAdminTeacher = null;
        
        // Check if classAdmin is populated object
        if (classItem.classAdmin && typeof classItem.classAdmin === 'object' && classItem.classAdmin._id) {
          classAdminTeacher = classItem.classAdmin;
        }
        // Check if classAdmin is just an ID string
        else if (classItem.classAdmin && typeof classItem.classAdmin === 'string') {
          classAdminTeacher = teachersMap.get(classItem.classAdmin);
        }
        // Check alternative field name
        else if (classItem.classAdminId) {
          classAdminTeacher = teachersMap.get(classItem.classAdminId);
        }
        
        if (classAdminTeacher) {
          console.log('Found class admin via class data:', classAdminTeacher.name, 'for class:', classItem.name);
          
          assignments.push({
            classId: classItem._id,
            className: classItem.name,
            classSection: classItem.section || 'N/A',
            teacherId: classAdminTeacher._id,
            teacherName: classAdminTeacher.name,
            teacherEmail: classAdminTeacher.email,
            assignedAt: classItem.createdAt,
            studentCount: classItem.studentIds?.length || 0,
            teacherCount: classItem.teacherIds?.length || 0,
            status: 'active',
          });
        }
      });
      
      // Strategy 3: Check teachers with isClassAdmin flag and assignedClasses
      teachersData.forEach((teacher: TeacherData) => {
        if (teacher.isClassAdmin && teacher.assignedClasses && teacher.assignedClasses.length > 0) {
          teacher.assignedClasses.forEach(classId => {
            // Skip if we already found an admin for this class
            if (assignments.some(admin => admin.classId === classId)) {
              return;
            }
            
            const assignedClass = classesData.find((cls: ClassData) => cls._id === classId);
            if (assignedClass) {
              console.log('Found class admin via isClassAdmin flag:', teacher.name, 'for class:', assignedClass.name);
              
              assignments.push({
                classId: assignedClass._id,
                className: assignedClass.name,
                classSection: assignedClass.section || 'N/A',
                teacherId: teacher._id,
                teacherName: teacher.name,
                teacherEmail: teacher.email,
                assignedAt: assignedClass.createdAt,
                studentCount: assignedClass.studentIds?.length || 0,
                teacherCount: assignedClass.teacherIds?.length || 0,
                status: 'active',
              });
            }
          });
        }
      });
      
      console.log('Final assignments:', assignments);
      setClassAdmins(assignments);
    } catch (error) {
      console.error('Error loading class admins:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadClasses();
    await loadTeachers();
    await loadClassAdmins();
  }, []);

  // Open assign class admin modal
  const openAssignModal = () => {
    setSelectedClassId(null);
    setSelectedTeacherId(null);
    setModalVisible(true);
  };

  // Assign class admin
  const assignClassAdmin = async () => {
    if (!selectedClassId || !selectedTeacherId) {
      Alert.alert('Validation Error', 'Please select both a class and a teacher');
      return;
    }

    try {
      setIsAssigning(true);
      const apiClient = await getAuthenticatedClient();
      
      await apiClient.post('/admin/classes/assign-class-admin', {
        classId: selectedClassId,
        teacherId: selectedTeacherId
      });
      
      Alert.alert('Success', 'Class administrator assigned successfully');
      setModalVisible(false);
      setSelectedClassId(null);
      setSelectedTeacherId(null);
      
      // Reload all data to reflect changes
      await loadClassAdmins();
      await loadClasses();
      await loadTeachers();
    } catch (error) {
      console.error('Error assigning class admin:', error);
      handleApiError(error);
    } finally {
      setIsAssigning(false);
    }
  };

  // Remove class admin
  const removeClassAdmin = async (classId: string, teacherName: string, className: string) => {
    Alert.alert(
      "Remove Class Administrator",
      `Are you sure you want to remove ${teacherName} as administrator for ${className}?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              const apiClient = await getAuthenticatedClient();
              
              await apiClient.post('/admin/classes/assign-class-admin', {
                classId: classId,
                teacherId: null // Send null to remove assignment
              });
              
              Alert.alert('Success', 'Class administrator removed successfully');
              
              // Reload all data to reflect changes
              await loadClassAdmins();
              await loadClasses();
              await loadTeachers();
            } catch (error) {
              console.error('Error removing class admin:', error);
              handleApiError(error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Update class admin (reassign)
  const updateClassAdmin = (classId: string, currentTeacherId: string) => {
    setSelectedClassId(classId);
    setSelectedTeacherId(currentTeacherId);
    setModalVisible(true);
  };

  // Handle API errors
  const handleApiError = (error: any) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
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
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('adminData');
      navigation.replace('RoleSelection');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  };

  // Filter class admins based on search query
  const filteredClassAdmins = classAdmins.filter(admin => 
    admin.className.toLowerCase().includes(searchQuery.toLowerCase()) || 
    admin.classSection.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.teacherName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get available classes for assignment (classes without class admin)
  const availableClasses = classes.filter(classItem => {
    // Check if this class already has an admin assigned
    const hasAdmin = classAdmins.some(admin => admin.classId === classItem._id);
    return !hasAdmin;
  });

  // Get status badge color and text
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'active':
        return { color: '#27AE60', bgColor: 'rgba(39, 174, 96, 0.1)', text: 'Active' };
      case 'pending':
        return { color: '#FFA502', bgColor: 'rgba(255, 165, 2, 0.1)', text: 'Pending' };
      case 'inactive':
        return { color: '#FF4757', bgColor: 'rgba(255, 71, 87, 0.1)', text: 'Inactive' };
      default:
        return { color: '#8A94A6', bgColor: 'rgba(138, 148, 166, 0.1)', text: 'Unknown' };
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Show loading indicator
  if (isLoading && !refreshing && classAdmins.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        <ActivityIndicator size="large" color="#4E54C8" />
        <Text style={styles.loadingText}>Loading class administrators...</Text>
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

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'assignments' && styles.activeTab]}
            onPress={() => setActiveTab('assignments')}
          >
            <Text style={[styles.tabText, activeTab === 'assignments' && styles.activeTabText]}>
              Current Assignments ({classAdmins.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'assign' && styles.activeTab]}
            onPress={() => setActiveTab('assign')}
          >
            <Text style={[styles.tabText, activeTab === 'assign' && styles.activeTabText]}>
              Assign New ({availableClasses.length})
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#8A94A6" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'assignments' ? "Search by class, section, or teacher..." : "Search classes..."}
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

        {activeTab === 'assignments' ? (
          // Current Assignments Tab
          <>
            {/* Enhanced Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <FontAwesome5 name="users-cog" size={20} color="#4E54C8" />
                <Text style={styles.statNumber}>{classAdmins.length}</Text>
                <Text style={styles.statLabel}>Class Admins</Text>
              </View>
              <View style={styles.statCard}>
                <FontAwesome5 name="book" size={20} color="#27AE60" />
                <Text style={styles.statNumber}>{classes.length}</Text>
                <Text style={styles.statLabel}>Total Classes</Text>
              </View>
              <View style={styles.statCard}>
                <FontAwesome5 name="exclamation-triangle" size={20} color="#FFA502" />
                <Text style={styles.statNumber}>{availableClasses.length}</Text>
                <Text style={styles.statLabel}>Need Admin</Text>
              </View>
            </View>

            {/* Class Admins List */}
            {filteredClassAdmins.length === 0 ? (
              <View style={styles.emptyContainer}>
                <FontAwesome5 name="user-shield" size={50} color="#D1D5DB" />
                <Text style={styles.emptyText}>
                  {classAdmins.length === 0 ? 'No class administrators assigned' : 'No results found'}
                </Text>
                <Text style={styles.emptySubText}>
                  {classAdmins.length === 0 
                    ? 'Assign teachers as class administrators to manage classes'
                    : 'Try adjusting your search criteria'
                  }
                </Text>
                {classAdmins.length === 0 && (
                  <TouchableOpacity 
                    style={styles.emptyActionButton}
                    onPress={() => setActiveTab('assign')}
                  >
                    <Text style={styles.emptyActionText}>Assign First Administrator</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={filteredClassAdmins}
                keyExtractor={(item) => `${item.classId}-${item.teacherId}`}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={["#4E54C8"]}
                  />
                }
                renderItem={({ item }) => {
                  const statusInfo = getStatusInfo(item.status);
                  return (
                    <View style={styles.assignmentCard}>
                      <View style={styles.assignmentHeader}>
                        <View style={styles.classInfoContainer}>
                          <View style={styles.classIconContainer}>
                            <Ionicons name="school" size={20} color="#4E54C8" />
                          </View>
                          <View style={styles.classDetails}>
                            <Text style={styles.className}>{item.className}</Text>
                            <Text style={styles.classSection}>Section: {item.classSection}</Text>
                            <Text style={styles.assignedDate}>Assigned: {formatDate(item.assignedAt)}</Text>
                          </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                          <Text style={[styles.statusText, { color: statusInfo.color }]}>
                            {statusInfo.text}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.teacherInfo}>
                        <View style={styles.teacherAvatar}>
                          <FontAwesome5 name="user-shield" size={16} color="#4E54C8" />
                        </View>
                        <View style={styles.teacherDetails}>
                          <Text style={styles.teacherName}>{item.teacherName}</Text>
                          <Text style={styles.teacherEmail}>{item.teacherEmail}</Text>
                          <Text style={styles.teacherRole}>Class Administrator</Text>
                        </View>
                      </View>

                      {/* Class Statistics */}
                      <View style={styles.classStatsContainer}>
                        <View style={styles.classStatItem}>
                          <FontAwesome5 name="user-graduate" size={14} color="#4E54C8" />
                          <Text style={styles.classStatText}>{item.studentCount} Students</Text>
                        </View>
                        <View style={styles.classStatItem}>
                          <FontAwesome5 name="chalkboard-teacher" size={14} color="#FFA502" />
                          <Text style={styles.classStatText}>{item.teacherCount} Teachers</Text>
                        </View>
                      </View>

                      <View style={styles.assignmentActions}>
                        <TouchableOpacity 
                          style={[styles.actionButton, styles.updateButton]}
                          onPress={() => updateClassAdmin(item.classId, item.teacherId)}
                        >
                          <Feather name="edit-2" size={16} color="#FFA502" />
                          <Text style={styles.updateButtonText}>Change Admin</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.actionButton, styles.removeButton]}
                          onPress={() => removeClassAdmin(item.classId, item.teacherName, item.className)}
                        >
                          <Feather name="user-minus" size={16} color="#FF4757" />
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </>
        ) : (
          // Assign New Tab
          <>
            {/* Add Class Admin Button */}
            <TouchableOpacity 
              style={styles.addButton}
              onPress={openAssignModal}
            >
              <Feather name="user-plus" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Assign Class Administrator</Text>
            </TouchableOpacity>

            {/* Available Classes List */}
            {availableClasses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <FontAwesome5 name="check-circle" size={50} color="#27AE60" />
                <Text style={styles.emptyText}>All classes have administrators</Text>
                <Text style={styles.emptySubText}>Every class in your school has been assigned a class administrator</Text>
              </View>
            ) : (
              <FlatList
                data={availableClasses.filter(c => 
                  c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  c.section.toLowerCase().includes(searchQuery.toLowerCase())
                )}
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
                  <TouchableOpacity
                    style={styles.availableClassCard}
                    onPress={() => {
                      setSelectedClassId(item._id);
                      setModalVisible(true);
                    }}
                  >
                    <View style={styles.classCardContent}>
                      <View style={styles.classIconContainer}>
                        <Ionicons name="book-outline" size={24} color="#8A94A6" />
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
                    </View>
                    
                    <View style={styles.needsAdminBadge}>
                      <Text style={styles.needsAdminText}>Needs Admin</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}
      </View>
      
      
      {/* Assign Class Admin Modal */}
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
                {selectedClassId && selectedTeacherId ? 'Update Class Administrator' : 'Assign Class Administrator'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color="#3A4276" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>Select a class and teacher to assign as class administrator</Text>
            
            {/* Class Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Select Class *</Text>
              <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
                {(selectedClassId ? classes : availableClasses).map((classItem) => (
                  <TouchableOpacity
                    key={classItem._id}
                    style={[
                      styles.selectionItem,
                      selectedClassId === classItem._id && styles.selectedItem
                    ]}
                    onPress={() => setSelectedClassId(classItem._id)}
                  >
                    <View style={styles.selectionItemContent}>
                      <Text style={styles.selectionItemTitle}>{classItem.name}</Text>
                      <Text style={styles.selectionItemSubtitle}>Section: {classItem.section || 'N/A'}</Text>
                    </View>
                    {selectedClassId === classItem._id && (
                      <Ionicons name="checkmark-circle" size={24} color="#4E54C8" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Teacher Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Select Teacher *</Text>
              <ScrollView style={styles.selectionList} showsVerticalScrollIndicator={false}>
                {teachers.map((teacher) => (
                  <TouchableOpacity
                    key={teacher._id}
                    style={[
                      styles.selectionItem,
                      selectedTeacherId === teacher._id && styles.selectedItem
                    ]}
                    onPress={() => setSelectedTeacherId(teacher._id)}
                  >
                    <View style={styles.teacherAvatar}>
                      <FontAwesome5 name="user" size={16} color="#4E54C8" />
                    </View>
                    <View style={styles.selectionItemContent}>
                      <Text style={styles.selectionItemTitle}>{teacher.name}</Text>
                      <Text style={styles.selectionItemSubtitle}>{teacher.email}</Text>
                    </View>
                    {selectedTeacherId === teacher._id && (
                      <Ionicons name="checkmark-circle" size={24} color="#4E54C8" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
                onPress={assignClassAdmin}
                disabled={!selectedClassId || !selectedTeacherId || isAssigning}
              >
                {isAssigning ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {selectedClassId && selectedTeacherId ? 'Update' : 'Assign'}
                  </Text>
                )}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#4E54C8',
  },
  tabText: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFFFFF',
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
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 4,
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
  emptyActionButton: {
    backgroundColor: '#4E54C8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  classInfoContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  classIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  classDetails: {
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
  },
  assignedDate: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '500',
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  teacherAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teacherDetails: {
    flex: 1,
  },
  teacherName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 2,
  },
  teacherEmail: {
    fontSize: 13,
    color: '#8A94A6',
  },
  teacherRole: {
    fontSize: 12,
    color: '#4E54C8',
    fontWeight: '500',
    marginTop: 2,
  },
  classStatsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 16,
  },
  classStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  classStatText: {
    fontSize: 12,
    color: '#8A94A6',
  },
  assignmentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  updateButton: {
    backgroundColor: 'rgba(255, 165, 2, 0.1)',
    borderWidth: 1,
    borderColor: '#FFA502',
  },
  updateButtonText: {
    color: '#FFA502',
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderWidth: 1,
    borderColor: '#FF4757',
  },
  removeButtonText: {
    color: '#FF4757',
    fontSize: 14,
    fontWeight: '500',
  },
  availableClassCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  classCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  classInfo: {
    flex: 1,
    marginLeft: 12,
  },
  classStats: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#8A94A6',
  },
  needsAdminBadge: {
    backgroundColor: 'rgba(255, 165, 2, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  needsAdminText: {
    fontSize: 12,
    color: '#FFA502',
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8A94A6',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A4276',
    marginBottom: 12,
  },
  selectionList: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectedItem: {
    backgroundColor: 'rgba(78, 84, 200, 0.05)',
    borderColor: '#4E54C8',
  },
  selectionItemContent: {
    flex: 1,
    marginLeft: 8,
  },
  selectionItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3A4276',
    marginBottom: 2,
  },
  selectionItemSubtitle: {
    fontSize: 13,
    color: '#8A94A6',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#4E54C8',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminAddClassTeacherScreen;