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
  FlatList,
  Modal,
  TextInput
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000;

type Props = NativeStackScreenProps<RootStackParamList, 'AdminAllClassesData'>;

interface ClassTeacher {
  _id: string;
  name: string;
  email: string;
}

interface ClassStudent {
  _id: string;
  name: string;
  email: string;
  studentId: string;
}

interface ClassAdmin {
  _id: string;
  name: string;
  email: string;
}

interface ClassData {
  _id: string;
  name: string;
  section?: string;
  schoolId: string;
  teacherIds: ClassTeacher[];
  studentIds: ClassStudent[];
  classAdmin: ClassAdmin | null;
  teacherCount: number;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ClassesResponse {
  classes: ClassData[];
  totalClasses: number;
  schoolId: string;
}

const AdminAllClassesDataScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [classesData, setClassesData] = useState<ClassData[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<ClassData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'students' | 'teachers' | 'recent'>('name');

  // Set header options
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'All Classes',
      headerStyle: {
        backgroundColor: '#4E54C8',
      },
      headerTintColor: '#FFFFFF',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 10 }}
        >
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  // Load classes data on component mount
  useEffect(() => {
    loadClassesData();
  }, []);

  // Filter classes when search query changes
  useEffect(() => {
    filterClasses();
  }, [searchQuery, classesData, sortBy]);

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

  // Load all classes data
  const loadClassesData = async () => {
    setIsLoading(true);
    try {
      if (!isConnected) {
        Alert.alert("No Internet", "Please check your internet connection and try again.");
        setIsLoading(false);
        return;
      }

      const apiClient = await getAuthenticatedClient();
      const response = await apiClient.get('/class/all');
      
      console.log('Classes loaded:', response.data);
      setClassesData(response.data.classes);
      
    } catch (error) {
      console.error('Error loading classes:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please login again.",
          [{ text: "OK", onPress: () => navigation.replace('RoleSelection') }]
        );
      } else {
        Alert.alert(
          "Error",
          "Failed to load classes data. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadClassesData();
  };

  // Filter and sort classes
  const filterClasses = () => {
    let filtered = classesData.filter(classItem =>
      classItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (classItem.section && classItem.section.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (classItem.classAdmin && classItem.classAdmin.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Sort classes
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => {
          const nameA = `${a.name} ${a.section || ''}`.trim();
          const nameB = `${b.name} ${b.section || ''}`.trim();
          return nameA.localeCompare(nameB);
        });
        break;
      case 'students':
        filtered.sort((a, b) => b.studentCount - a.studentCount);
        break;
      case 'teachers':
        filtered.sort((a, b) => b.teacherCount - a.teacherCount);
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    setFilteredClasses(filtered);
  };

  // Show class details modal
  const showClassDetails = (classItem: ClassData) => {
    setSelectedClass(classItem);
    setModalVisible(true);
  };

  // Navigate to class management
  const navigateToClassManagement = (classItem: ClassData) => {
    // You can create a detailed class management screen later
    Alert.alert(
      "Class Management",
      `Manage ${classItem.name} ${classItem.section || ''}`,
      [
        { text: "View Details", onPress: () => showClassDetails(classItem) },
        { text: "Cancel", style: "cancel" }
      ]
    );
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

  // Render class card
  const renderClassCard = ({ item }: { item: ClassData }) => (
    <TouchableOpacity
      style={styles.classCard}
      onPress={() => navigateToClassManagement(item)}
    >
      <View style={styles.classHeader}>
        <View style={styles.classNameContainer}>
          <Text style={styles.className}>{item.name}</Text>
          {item.section && <Text style={styles.classSection}>Section {item.section}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => showClassDetails(item)}
          style={styles.infoButton}
        >
          <Feather name="info" size={20} color="#4E54C8" />
        </TouchableOpacity>
      </View>

      <View style={styles.classStats}>
        <View style={styles.statItem}>
          <FontAwesome5 name="user-graduate" size={16} color="#2ED573" />
          <Text style={styles.statText}>{item.studentCount} Students</Text>
        </View>
        <View style={styles.statItem}>
          <FontAwesome5 name="chalkboard-teacher" size={16} color="#4E54C8" />
          <Text style={styles.statText}>{item.teacherCount} Teachers</Text>
        </View>
      </View>

      {item.classAdmin && (
        <View style={styles.classAdminContainer}>
          <FontAwesome5 name="user-tie" size={14} color="#FFA502" />
          <Text style={styles.classAdminText}>
            Class Admin: {item.classAdmin.name}
          </Text>
        </View>
      )}

      <View style={styles.classFooter}>
        <Text style={styles.createdDate}>Created: {formatDate(item.createdAt)}</Text>
        <Feather name="chevron-right" size={20} color="#8A94A6" />
      </View>
    </TouchableOpacity>
  );

  // Render class details modal
  const renderClassDetailsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedClass?.name} {selectedClass?.section ? `- Section ${selectedClass.section}` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Feather name="x" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Class Admin */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Class Administrator</Text>
              {selectedClass?.classAdmin ? (
                <View style={styles.adminInfo}>
                  <FontAwesome5 name="user-tie" size={18} color="#FFA502" />
                  <View style={styles.adminDetails}>
                    <Text style={styles.adminName}>{selectedClass.classAdmin.name}</Text>
                    <Text style={styles.adminEmail}>{selectedClass.classAdmin.email}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.noDataText}>No class admin assigned</Text>
              )}
            </View>

            {/* Teachers */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>
                Teachers ({selectedClass?.teacherCount || 0})
              </Text>
              {selectedClass?.teacherIds && selectedClass.teacherIds.length > 0 ? (
                selectedClass.teacherIds.map((teacher) => (
                  <View key={teacher._id} style={styles.listItem}>
                    <FontAwesome5 name="chalkboard-teacher" size={16} color="#4E54C8" />
                    <View style={styles.listItemText}>
                      <Text style={styles.listItemName}>{teacher.name}</Text>
                      <Text style={styles.listItemEmail}>{teacher.email}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>No teachers assigned</Text>
              )}
            </View>

            {/* Students */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>
                Students ({selectedClass?.studentCount || 0})
              </Text>
              {selectedClass?.studentIds && selectedClass.studentIds.length > 0 ? (
                <ScrollView style={styles.studentsList} nestedScrollEnabled>
                  {selectedClass.studentIds.slice(0, 10).map((student) => (
                    <View key={student._id} style={styles.listItem}>
                      <FontAwesome5 name="user-graduate" size={16} color="#2ED573" />
                      <View style={styles.listItemText}>
                        <Text style={styles.listItemName}>{student.name}</Text>
                        <Text style={styles.listItemEmail}>
                          {student.studentId} • {student.email}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {selectedClass.studentIds.length > 10 && (
                    <Text style={styles.moreText}>
                      And {selectedClass.studentIds.length - 10} more students...
                    </Text>
                  )}
                </ScrollView>
              ) : (
                <Text style={styles.noDataText}>No students enrolled</Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Show loading screen
  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#4E54C8" />
        <ActivityIndicator size="large" color="#4E54C8" />
        <Text style={styles.loadingText}>Loading classes...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4E54C8" />
      
      {/* Search and Filter Section */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={20} color="#8A94A6" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search classes, sections, or admin..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8A94A6"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={20} color="#8A94A6" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
        >
          {[
            { key: 'name', label: 'Name', icon: 'type' },
            { key: 'students', label: 'Students', icon: 'users' },
            { key: 'teachers', label: 'Teachers', icon: 'user' },
            { key: 'recent', label: 'Recent', icon: 'clock' }
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                sortBy === filter.key && styles.filterButtonActive
              ]}
              onPress={() => setSortBy(filter.key as any)}
            >
              <Feather 
                name={filter.icon as any} 
                size={16} 
                color={sortBy === filter.key ? '#FFFFFF' : '#4E54C8'} 
              />
              <Text style={[
                styles.filterText,
                sortBy === filter.key && styles.filterTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats Header */}
      <View style={styles.statsHeader}>
        <View style={styles.statHeaderItem}>
          <Text style={styles.statHeaderNumber}>{filteredClasses.length}</Text>
          <Text style={styles.statHeaderLabel}>
            {filteredClasses.length === 1 ? 'Class' : 'Classes'}
            {searchQuery ? ' Found' : ' Total'}
          </Text>
        </View>
        <View style={styles.statHeaderItem}>
          <Text style={styles.statHeaderNumber}>
            {filteredClasses.reduce((sum, cls) => sum + cls.studentCount, 0)}
          </Text>
          <Text style={styles.statHeaderLabel}>Total Students</Text>
        </View>
        <View style={styles.statHeaderItem}>
          <Text style={styles.statHeaderNumber}>
            {filteredClasses.reduce((sum, cls) => sum + cls.teacherCount, 0)}
          </Text>
          <Text style={styles.statHeaderLabel}>Total Teachers</Text>
        </View>
      </View>

      {/* Classes List */}
      <FlatList
        data={filteredClasses}
        renderItem={renderClassCard}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#4E54C8"]}
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="school" size={64} color="#E0E0E0" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No classes found' : 'No classes created yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Create your first class to get started'
              }
            </Text>
          </View>
        }
      />

      {/* Class Details Modal */}
      {renderClassDetailsModal()}
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
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4E54C8',
  },
  filterButtonActive: {
    backgroundColor: '#4E54C8',
  },
  filterText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#4E54C8',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  statHeaderItem: {
    flex: 1,
    alignItems: 'center',
  },
  statHeaderNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4E54C8',
  },
  statHeaderLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  classCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  classNameContainer: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  classSection: {
    fontSize: 14,
    color: '#666',
  },
  infoButton: {
    padding: 4,
  },
  classStats: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  classAdminContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
  },
  classAdminText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#B8860B',
    fontWeight: '500',
  },
  classFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  createdDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  adminInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
  },
  adminDetails: {
    marginLeft: 12,
    flex: 1,
  },
  adminName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  adminEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  listItemText: {
    marginLeft: 12,
    flex: 1,
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  listItemEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  studentsList: {
    maxHeight: 200,
  },
  moreText: {
    fontSize: 14,
    color: '#4E54C8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

export default AdminAllClassesDataScreen;