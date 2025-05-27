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

type Props = NativeStackScreenProps<RootStackParamList, 'AdminAllTeachersData'>;

interface TeacherData {
  _id: string;
  name?: string;
  email?: string;
  teacherId?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  subjects?: string[];
  joiningDate?: string;
  qualification?: string;
  experience?: number;
  status?: 'active' | 'inactive';
  createdAt: string;
  classesAssigned?: string[];
}

interface FilterOptions {
  status: 'all' | 'active' | 'inactive';
  subject: string;
  searchTerm: string;
}

const { width } = Dimensions.get('window');

const AdminAllTeachersDataScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<TeacherData[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherData | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    subject: '',
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
    loadTeachersData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [teachers, filters]);

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

  const loadTeachersData = async () => {
    setIsLoading(true);
    try {
      const apiClient = await getAuthenticatedClient();
      const response = await apiClient.get('/admin/teachers');
      setTeachers(response.data);
    } catch (error) {
      console.error('Error loading teachers data:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please login again.",
          [{ text: "OK", onPress: () => navigation.replace('RoleSelection') }]
        );
      } else {
        Alert.alert(
          "Error",
          "Failed to load teachers data. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = teachers;

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(teacher => teacher.status === filters.status);
    }

    // Filter by subject
    if (filters.subject) {
      filtered = filtered.filter(teacher => 
        teacher.subjects?.some(subject => 
          subject && subject.toLowerCase().includes(filters.subject.toLowerCase())
        )
      );
    }

    // Filter by search term
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(teacher =>
        (teacher.name && teacher.name.toLowerCase().includes(searchTerm)) ||
        (teacher.email && teacher.email.toLowerCase().includes(searchTerm)) ||
        (teacher.teacherId && teacher.teacherId.toLowerCase().includes(searchTerm))
      );
    }

    setFilteredTeachers(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTeachersData();
  };

  const handleTeacherPress = (teacher: TeacherData) => {
    setSelectedTeacher(teacher);
    setIsDetailModalVisible(true);
  };

  const resetFilters = () => {
    setFilters({
      status: 'all',
      subject: '',
      searchTerm: ''
    });
  };

  const getStatusColor = (status?: string) => {
    return status === 'active' ? '#2ED573' : '#FF6B6B';
  };

  const getStatusText = (status?: string) => {
    return status ? status.toUpperCase() : 'UNKNOWN';
  };

  const getTeacherInitial = (name?: string) => {
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
          <Text style={styles.headerTitle}>Teachers Directory</Text>
          <Text style={styles.headerSubtitle}>All Teachers Detailed Directory</Text>
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
          <Text style={styles.statsNumber}>{teachers.length}</Text>
          <Text style={styles.statsLabel}>Total</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={[styles.statsNumber, { color: '#2ED573' }]}>
            {teachers.filter(t => t.status === 'active').length}
          </Text>
          <Text style={styles.statsLabel}>Active</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={[styles.statsNumber, { color: '#FF6B6B' }]}>
            {teachers.filter(t => t.status === 'inactive').length}
          </Text>
          <Text style={styles.statsLabel}>Inactive</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={[styles.statsNumber, { color: '#4E54C8' }]}>
            {filteredTeachers.length}
          </Text>
          <Text style={styles.statsLabel}>Showing</Text>
        </View>
      </View>
    </View>
  );

  const renderFiltersPanel = () => (
    <View style={[styles.filtersPanel, { maxHeight: showFilters ? 300 : 0, opacity: showFilters ? 1 : 0 }]}>
      <View style={styles.filterContent}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Search Teachers</Text>
          <View style={styles.searchContainer}>
            <Feather name="search" size={16} color="#8A94A6" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Name, email, or ID..."
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
          <Text style={styles.filterLabel}>Filter by Subject</Text>
          <View style={styles.searchContainer}>
            <FontAwesome5 name="book" size={14} color="#8A94A6" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Enter subject name..."
              value={filters.subject}
              onChangeText={(text) => setFilters(prev => ({ ...prev, subject: text }))}
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

  const renderTeacherCard = (teacher: TeacherData) => (
    <TouchableOpacity
      key={teacher._id}
      style={styles.teacherCard}
      onPress={() => handleTeacherPress(teacher)}
    >
      <View style={styles.teacherCardHeader}>
        <View style={styles.teacherAvatar}>
          <Text style={styles.avatarText}>
            {getTeacherInitial(teacher.name)}
          </Text>
        </View>
        
        <View style={styles.teacherBasicInfo}>
          <Text style={styles.teacherName} numberOfLines={1}>
            {teacher.name || 'Unknown Teacher'}
          </Text>
          <Text style={styles.teacherId} numberOfLines={1}>
            ID: {teacher.teacherId || 'Not assigned'}
          </Text>
          <Text style={styles.teacherEmail} numberOfLines={1}>
            {teacher.email || 'No email provided'}
          </Text>
        </View>
        
        <View style={styles.teacherStatus}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(teacher.status) }]}>
            <Text style={styles.statusText}>
              {getStatusText(teacher.status)}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.teacherCardFooter}>
        <View style={styles.teacherMetaInfo}>
          <View style={styles.metaItem}>
            <FontAwesome5 name="book" size={12} color="#8A94A6" />
            <Text style={styles.metaText} numberOfLines={1}>
              {teacher.subjects && teacher.subjects.length > 0 
                ? `${teacher.subjects.length} subject${teacher.subjects.length > 1 ? 's' : ''}`
                : 'No subjects'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <FontAwesome5 name="calendar" size={12} color="#8A94A6" />
            <Text style={styles.metaText}>
              {teacher.experience ? `${teacher.experience} years` : 'No exp.'}
            </Text>
          </View>
        </View>
        
        <Feather name="chevron-right" size={20} color="#8A94A6" />
      </View>
    </TouchableOpacity>
  );

  const renderTeacherDetailModal = () => (
    <Modal
      visible={isDetailModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Teacher Details</Text>
          <TouchableOpacity
            onPress={() => setIsDetailModalVisible(false)}
            style={styles.closeButton}
          >
            <Feather name="x" size={24} color="#3A4276" />
          </TouchableOpacity>
        </View>
        
        {selectedTeacher && (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.teacherDetailCard}>
              <View style={styles.detailAvatarContainer}>
                <Text style={styles.detailAvatarText}>
                  {getTeacherInitial(selectedTeacher.name)}
                </Text>
              </View>
              
              <Text style={styles.detailName}>{selectedTeacher.name || 'Unknown Teacher'}</Text>
              <Text style={styles.detailEmail}>{selectedTeacher.email || 'No email provided'}</Text>
              
              <View style={[styles.detailStatusBadge, { backgroundColor: getStatusColor(selectedTeacher.status) }]}>
                <Text style={styles.detailStatusText}>
                  {getStatusText(selectedTeacher.status)}
                </Text>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Teacher ID:</Text>
                <Text style={styles.detailValue}>{selectedTeacher.teacherId || 'Not assigned'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone:</Text>
                <Text style={styles.detailValue}>{selectedTeacher.phone || 'Not provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Joining Date:</Text>
                <Text style={styles.detailValue}>
                  {formatDate(selectedTeacher.joiningDate)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Experience:</Text>
                <Text style={styles.detailValue}>
                  {selectedTeacher.experience ? `${selectedTeacher.experience} years` : 'Not provided'}
                </Text>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Professional Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Qualification:</Text>
                <Text style={styles.detailValue}>{selectedTeacher.qualification || 'Not provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Subjects:</Text>
                <Text style={styles.detailValue}>
                  {selectedTeacher.subjects && selectedTeacher.subjects.length > 0 
                    ? selectedTeacher.subjects.join(', ') 
                    : 'No subjects assigned'}
                </Text>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Address Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address:</Text>
                <Text style={styles.detailValue}>{selectedTeacher.address || 'Not provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>City:</Text>
                <Text style={styles.detailValue}>{selectedTeacher.city || 'Not provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>State:</Text>
                <Text style={styles.detailValue}>{selectedTeacher.state || 'Not provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>ZIP Code:</Text>
                <Text style={styles.detailValue}>{selectedTeacher.zip || 'Not provided'}</Text>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Account Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Created:</Text>
                <Text style={styles.detailValue}>{formatDate(selectedTeacher.createdAt)}</Text>
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
        <ActivityIndicator size="large" color="#4E54C8" />
        <Text style={styles.loadingText}>Loading teachers data...</Text>
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
            colors={["#4E54C8"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredTeachers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome5 name="user-times" size={60} color="#8A94A6" />
            </View>
            <Text style={styles.emptyText}>No teachers found</Text>
            <Text style={styles.emptySubtext}>
              {teachers.length === 0 
                ? "No teachers are registered in your school yet."
                : "Try adjusting your filters to see more results."
              }
            </Text>
            {filters.searchTerm || filters.subject || filters.status !== 'all' ? (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={resetFilters}>
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.teachersContainer}>
            {filteredTeachers.map((teacher) => renderTeacherCard(teacher))}
          </View>
        )}
      </ScrollView>
      
      {renderTeacherDetailModal()}
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
    backgroundColor: '#4E54C8',
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
  teachersContainer: {
    paddingTop: 16,
  },
  teacherCard: {
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
  teacherCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teacherAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4E54C8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  teacherBasicInfo: {
    flex: 1,
    marginRight: 12,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 2,
  },
  teacherId: {
    fontSize: 12,
    color: '#8A94A6',
    marginBottom: 2,
  },
  teacherEmail: {
    fontSize: 13,
    color: '#4E54C8',
  },
  teacherStatus: {
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
  teacherCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F8',
  },
  teacherMetaInfo: {
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
    backgroundColor: '#4E54C8',
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
  teacherDetailCard: {
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
    backgroundColor: '#4E54C8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  detailName: {
    fontSize: 20,
    fontWeight: 'bold',
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
    paddingVertical: 8,
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
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F8',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FC',
  },
  detailLabel: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  detailValue: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '400',
    flex: 2,
    textAlign: 'right',
  },
});

export default AdminAllTeachersDataScreen;