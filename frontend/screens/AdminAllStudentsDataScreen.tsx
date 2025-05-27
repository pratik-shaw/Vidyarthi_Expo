import React, { useEffect, useState } from 'react';
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
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = 'http://192.168.29.148:5000/api';
const API_TIMEOUT = 15000;

type Props = NativeStackScreenProps<RootStackParamList, 'AdminAllStudentsData'>;

interface StudentData {
  _id: string;
  name?: string;
  email?: string;
  studentId?: string;
  phone?: string;
  uniqueId?: string;
  schoolId?: string;
  classId?: string;
  className?: string;
  section?: string;
  isActive?: boolean;
  createdAt: string;
}

interface FilterOptions {
  status: 'all' | 'active' | 'inactive';
  class: string;
  section: string;
  searchTerm: string;
}

const { width } = Dimensions.get('window');

const AdminAllStudentsDataScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentData[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    class: '',
    section: '',
    searchTerm: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Set header options
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    loadStudentsData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [students, filters]);

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

  const loadStudentsData = async () => {
    setIsLoading(true);
    try {
      const apiClient = await getAuthenticatedClient();
      const response = await apiClient.get('/admin/students/complete');
      setStudents(response.data);
    } catch (error) {
      console.error('Error loading students data:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please login again.",
          [{ text: "OK", onPress: () => navigation.replace('RoleSelection') }]
        );
      } else {
        Alert.alert(
          "Error",
          "Failed to load students data. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = students;

    // Filter by status
    if (filters.status !== 'all') {
      const isActive = filters.status === 'active';
      filtered = filtered.filter(student => student.isActive === isActive);
    }

    // Filter by class
    if (filters.class) {
      filtered = filtered.filter(student => 
        student.className && student.className.toLowerCase().includes(filters.class.toLowerCase())
      );
    }

    // Filter by section
    if (filters.section) {
      filtered = filtered.filter(student => 
        student.section && student.section.toLowerCase().includes(filters.section.toLowerCase())
      );
    }

    // Filter by search term
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(student =>
        (student.name && student.name.toLowerCase().includes(searchTerm)) ||
        (student.email && student.email.toLowerCase().includes(searchTerm)) ||
        (student.studentId && student.studentId.toLowerCase().includes(searchTerm)) ||
        (student.uniqueId && student.uniqueId.toLowerCase().includes(searchTerm))
      );
    }

    setFilteredStudents(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudentsData();
  };

  const handleStudentPress = (student: StudentData) => {
    setSelectedStudent(student);
    setIsDetailModalVisible(true);
  };

  const resetFilters = () => {
    setFilters({
      status: 'all',
      class: '',
      section: '',
      searchTerm: ''
    });
  };

  const getStatusColor = (isActive?: boolean) => {
    return isActive !== false ? '#2ED573' : '#FF6B6B';
  };

  const getStatusText = (isActive?: boolean) => {
    return isActive !== false ? 'ACTIVE' : 'INACTIVE';
  };

  const getStudentInitial = (name?: string) => {
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : '?';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not provided';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getUniqueClasses = () => {
    const classes = students
      .map(s => s.className)
      .filter((className, index, array) => className && array.indexOf(className) === index)
      .sort();
    return classes;
  };

  const getUniqueSections = () => {
    const sections = students
      .map(s => s.section)
      .filter((section, index, array) => section && array.indexOf(section) === index)
      .sort();
    return sections;
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#3A4276" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Students Directory</Text>
          <Text style={styles.headerSubtitle}>All Students Detailed Directory</Text>
        </View>
        
        <TouchableOpacity 
          onPress={() => setShowFilters(!showFilters)}
          style={[styles.filterButton, showFilters && styles.filterButtonActive]}
        >
          <Feather name="filter" size={20} color={showFilters ? "#FFFFFF" : "#3A4276"} />
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statsItem}>
          <Text style={styles.statsNumber}>{students.length}</Text>
          <Text style={styles.statsLabel}>Total</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={[styles.statsNumber, { color: '#2ED573' }]}>
            {students.filter(s => s.isActive !== false).length}
          </Text>
          <Text style={styles.statsLabel}>Active</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={[styles.statsNumber, { color: '#FF6B6B' }]}>
            {students.filter(s => s.isActive === false).length}
          </Text>
          <Text style={styles.statsLabel}>Inactive</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={[styles.statsNumber, { color: '#2ED573' }]}>
            {filteredStudents.length}
          </Text>
          <Text style={styles.statsLabel}>Showing</Text>
        </View>
      </View>
    </View>
  );

  const renderFiltersPanel = () => (
    <View style={[styles.filtersPanel, { maxHeight: showFilters ? 400 : 0, opacity: showFilters ? 1 : 0 }]}>
      <View style={styles.filterContent}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Search Students</Text>
          <View style={styles.searchContainer}>
            <Feather name="search" size={16} color="#8A94A6" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Name, email, student ID, or unique ID..."
              value={filters.searchTerm}
              onChangeText={(text) => setFilters(prev => ({ ...prev, searchTerm: text }))}
              placeholderTextColor="#8A94A6"
            />
          </View>
        </View>
        
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Filter by Status</Text>
          <View style={styles.statusFilters}>
            {[
              { key: 'all', label: 'All', color: '#8A94A6' },
              { key: 'active', label: 'Active', color: '#2ED573' },
              { key: 'inactive', label: 'Inactive', color: '#FF6B6B' }
            ].map((status) => (
              <TouchableOpacity
                key={status.key}
                style={[
                  styles.statusFilterButton,
                  filters.status === status.key && { backgroundColor: status.color }
                ]}
                onPress={() => setFilters(prev => ({ ...prev, status: status.key as any }))}
              >
                <Text style={[
                  styles.statusFilterText,
                  filters.status === status.key && { color: '#FFFFFF' }
                ]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Filter by Class</Text>
          <View style={styles.searchContainer}>
            <FontAwesome5 name="graduation-cap" size={14} color="#8A94A6" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Enter class name..."
              value={filters.class}
              onChangeText={(text) => setFilters(prev => ({ ...prev, class: text }))}
              placeholderTextColor="#8A94A6"
            />
          </View>
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Filter by Section</Text>
          <View style={styles.searchContainer}>
            <FontAwesome5 name="users" size={14} color="#8A94A6" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Enter section..."
              value={filters.section}
              onChangeText={(text) => setFilters(prev => ({ ...prev, section: text }))}
              placeholderTextColor="#8A94A6"
            />
          </View>
        </View>
        
        <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
          <Feather name="refresh-cw" size={16} color="#FFFFFF" />
          <Text style={styles.resetButtonText}>Reset Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStudentCard = (student: StudentData) => (
    <TouchableOpacity
      key={student._id}
      style={styles.studentCard}
      onPress={() => handleStudentPress(student)}
    >
      <View style={styles.studentCardHeader}>
        <View style={styles.studentAvatar}>
          <Text style={styles.avatarText}>
            {getStudentInitial(student.name)}
          </Text>
        </View>
        
        <View style={styles.studentBasicInfo}>
          <Text style={styles.studentName} numberOfLines={1}>
            {student.name || 'Unknown Student'}
          </Text>
          <Text style={styles.studentId} numberOfLines={1}>
            ID: {student.studentId || 'Not assigned'}
          </Text>
          <Text style={styles.studentEmail} numberOfLines={1}>
            {student.email || 'No email provided'}
          </Text>
        </View>
        
        <View style={styles.studentStatus}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(student.isActive) }]}>
            <Text style={styles.statusText}>
              {getStatusText(student.isActive)}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.studentCardFooter}>
        <View style={styles.studentMetaInfo}>
          <View style={styles.metaItem}>
            <FontAwesome5 name="graduation-cap" size={12} color="#8A94A6" />
            <Text style={styles.metaText} numberOfLines={1}>
              {student.className || 'No class'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <FontAwesome5 name="users" size={12} color="#8A94A6" />
            <Text style={styles.metaText}>
              {student.section || 'No section'}
            </Text>
          </View>
        </View>
        
        <Feather name="chevron-right" size={20} color="#8A94A6" />
      </View>
    </TouchableOpacity>
  );

  const renderStudentDetailModal = () => (
    <Modal
      visible={isDetailModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Student Details</Text>
          <TouchableOpacity
            onPress={() => setIsDetailModalVisible(false)}
            style={styles.closeButton}
          >
            <Feather name="x" size={24} color="#3A4276" />
          </TouchableOpacity>
        </View>
        
        {selectedStudent && (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.studentDetailCard}>
              <View style={styles.detailAvatarContainer}>
                <Text style={styles.detailAvatarText}>
                  {getStudentInitial(selectedStudent.name)}
                </Text>
              </View>
              
              <Text style={styles.detailName}>{selectedStudent.name || 'Unknown Student'}</Text>
              <Text style={styles.detailEmail}>{selectedStudent.email || 'No email provided'}</Text>
              
              <View style={[styles.detailStatusBadge, { backgroundColor: getStatusColor(selectedStudent.isActive) }]}>
                <Text style={styles.detailStatusText}>
                  {getStatusText(selectedStudent.isActive)}
                </Text>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Student ID:</Text>
                <Text style={styles.detailValue}>{selectedStudent.studentId || 'Not assigned'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Unique ID:</Text>
                <Text style={styles.detailValue}>{selectedStudent.uniqueId || 'Not assigned'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone:</Text>
                <Text style={styles.detailValue}>{selectedStudent.phone || 'Not provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Registration Date:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(selectedStudent.createdAt)}
                </Text>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Academic Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Class:</Text>
                <Text style={styles.detailValue}>{selectedStudent.className || 'Not assigned'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Section:</Text>
                <Text style={styles.detailValue}>{selectedStudent.section || 'Not assigned'}</Text>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Account Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Account Status:</Text>
                <Text style={[styles.detailValue, { color: getStatusColor(selectedStudent.isActive) }]}>
                  {selectedStudent.isActive !== false ? 'Active' : 'Inactive'}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created:</Text>
                <Text style={styles.detailValue}>{formatDate(selectedStudent.createdAt)}</Text>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        <ActivityIndicator size="large" color="#2ED573" />
        <Text style={styles.loadingText}>Loading students data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      {renderHeader()}
      {renderFiltersPanel()}
      
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#2ED573"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredStudents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome5 name="user-graduate" size={60} color="#8A94A6" />
            </View>
            <Text style={styles.emptyText}>No students found</Text>
            <Text style={styles.emptySubtext}>
              {students.length === 0 
                ? "No students are registered in your school yet."
                : "Try adjusting your filters to see more results."
              }
            </Text>
            {filters.searchTerm || filters.class || filters.section || filters.status !== 'all' ? (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={resetFilters}>
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.studentsContainer}>
            {filteredStudents.map((student) => renderStudentCard(student))}
          </View>
        )}
      </ScrollView>
      
      {renderStudentDetailModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
    marginTop: 12,
    fontSize: 16,
    color: '#3A4276',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A4276',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8A94A6',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2ED573',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsItem: {
    alignItems: 'center',
    flex: 1,
  },
  statsNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3A4276',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 12,
    color: '#8A94A6',
  },
  filtersPanel: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
  },
  filterContent: {
    padding: 16,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#3A4276',
  },
  statusFilters: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#E8EAED',
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statusFilterText: {
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '500',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  studentsContainer: {
    paddingTop: 16,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  studentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2ED573',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  studentBasicInfo: {
    flex: 1,
    marginRight: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 2,
  },
  studentId: {
    fontSize: 12,
    color: '#8A94A6',
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: 13,
    color: '#2ED573',
  },
  studentStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  studentCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F8',
  },
  studentMetaInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaText: {
    fontSize: 12,
    color: '#8A94A6',
    marginLeft: 4,
    maxWidth: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(138, 148, 166, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  clearFiltersButton: {
    backgroundColor: '#2ED573',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  clearFiltersText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3A4276',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  studentDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  detailAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2ED573',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  detailName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
    textAlign: 'center',
  },
  detailEmail: {
    fontSize: 14,
    color: '#8A94A6',
    marginBottom: 16,
    textAlign: 'center',
  },
  detailStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  detailStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F8',
  },
  detailLabel: {
    fontSize: 14,
    color: '#8A94A6',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
});

export default AdminAllStudentsDataScreen;