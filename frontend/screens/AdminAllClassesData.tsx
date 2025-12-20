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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

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
  teacherIds: ClassTeacher[];
  studentIds: ClassStudent[];
  classAdmin: ClassAdmin | null;
  teacherCount: number;
  studentCount: number;
  createdAt: string;
}

const AdminAllClassesDataScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    loadClassesData();
  }, []);

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

  const loadClassesData = async () => {
    setIsLoading(true);
    try {
      const apiClient = await getAuthenticatedClient();
      const response = await apiClient.get('/class/all');
      const sortedClasses = response.data.classes.sort((a: ClassData, b: ClassData) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setClasses(sortedClasses);
    } catch (error) {
      console.error('Error loading classes:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please login again.",
          [{ text: "OK", onPress: () => navigation.replace('RoleSelection') }]
        );
      } else {
        Alert.alert("Error", "Failed to load classes data. Please try again.");
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClassesData();
  };

  const handleClassPress = (classItem: ClassData) => {
    setSelectedClass(classItem);
    setIsDetailModalVisible(true);
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

  const getClassInitial = (name?: string) => {
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : '?';
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#3A4276" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Classes Directory</Text>
          <Text style={styles.headerSubtitle}>All Classes Detailed Directory</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statsItem}>
          <Text style={styles.statsNumber}>{classes.length}</Text>
          <Text style={styles.statsLabel}>Total Classes</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={[styles.statsNumber, { color: '#2ED573' }]}>
            {classes.reduce((sum, cls) => sum + cls.studentCount, 0)}
          </Text>
          <Text style={styles.statsLabel}>Students</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={[styles.statsNumber, { color: '#4E54C8' }]}>
            {classes.reduce((sum, cls) => sum + cls.teacherCount, 0)}
          </Text>
          <Text style={styles.statsLabel}>Teachers</Text>
        </View>
      </View>
    </View>
  );

  const renderClassCard = (classItem: ClassData) => (
    <TouchableOpacity
      key={classItem._id}
      style={styles.classCard}
      onPress={() => handleClassPress(classItem)}
    >
      <View style={styles.classCardHeader}>
        <View style={styles.classAvatar}>
          <Text style={styles.avatarText}>{getClassInitial(classItem.name)}</Text>
        </View>
        
        <View style={styles.classBasicInfo}>
          <Text style={styles.className} numberOfLines={1}>
            {classItem.name} {classItem.section ? `(${classItem.section})` : ''}
          </Text>
          {classItem.classAdmin && (
            <Text style={styles.classAdmin} numberOfLines={1}>
              Admin: {classItem.classAdmin.name}
            </Text>
          )}
          <Text style={styles.classDate} numberOfLines={1}>
            Created: {formatDate(classItem.createdAt)}
          </Text>
        </View>
        
        <Feather name="chevron-right" size={20} color="#8A94A6" />
      </View>
      
      <View style={styles.classCardFooter}>
        <View style={styles.metaItem}>
          <FontAwesome5 name="user-graduate" size={12} color="#2ED573" />
          <Text style={styles.metaText}>{classItem.studentCount} Students</Text>
        </View>
        <View style={styles.metaItem}>
          <FontAwesome5 name="chalkboard-teacher" size={12} color="#4E54C8" />
          <Text style={styles.metaText}>{classItem.teacherCount} Teachers</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderClassDetailModal = () => (
    <Modal
      visible={isDetailModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Class Details</Text>
          <TouchableOpacity
            onPress={() => setIsDetailModalVisible(false)}
            style={styles.closeButton}
          >
            <Feather name="x" size={24} color="#3A4276" />
          </TouchableOpacity>
        </View>
        
        {selectedClass && (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailCard}>
              <View style={styles.detailAvatarContainer}>
                <Text style={styles.detailAvatarText}>
                  {getClassInitial(selectedClass.name)}
                </Text>
              </View>
              
              <Text style={styles.detailName}>
                {selectedClass.name} {selectedClass.section ? `- Section ${selectedClass.section}` : ''}
              </Text>
              
              <View style={styles.detailStats}>
                <View style={styles.detailStatItem}>
                  <Text style={styles.detailStatNumber}>{selectedClass.studentCount}</Text>
                  <Text style={styles.detailStatLabel}>Students</Text>
                </View>
                <View style={styles.detailStatItem}>
                  <Text style={styles.detailStatNumber}>{selectedClass.teacherCount}</Text>
                  <Text style={styles.detailStatLabel}>Teachers</Text>
                </View>
              </View>
            </View>
            
            {selectedClass.classAdmin && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Class Administrator</Text>
                <View style={styles.adminInfo}>
                  <FontAwesome5 name="user-tie" size={16} color="#FFA502" />
                  <View style={styles.adminDetails}>
                    <Text style={styles.adminName}>{selectedClass.classAdmin.name}</Text>
                    <Text style={styles.adminEmail}>{selectedClass.classAdmin.email}</Text>
                  </View>
                </View>
              </View>
            )}
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Teachers ({selectedClass.teacherCount})</Text>
              {selectedClass.teacherIds && selectedClass.teacherIds.length > 0 ? (
                selectedClass.teacherIds.map((teacher) => (
                  <View key={teacher._id} style={styles.listItem}>
                    <FontAwesome5 name="chalkboard-teacher" size={14} color="#4E54C8" />
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
            
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Students ({selectedClass.studentCount})</Text>
              {selectedClass.studentIds && selectedClass.studentIds.length > 0 ? (
                <>
                  {selectedClass.studentIds.slice(0, 10).map((student) => (
                    <View key={student._id} style={styles.listItem}>
                      <FontAwesome5 name="user-graduate" size={14} color="#2ED573" />
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
                </>
              ) : (
                <Text style={styles.noDataText}>No students enrolled</Text>
              )}
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
        <Text style={styles.loadingText}>Loading classes data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      {renderHeader()}
      
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2ED573"]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {classes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome5 name="school" size={60} color="#8A94A6" />
            </View>
            <Text style={styles.emptyText}>No classes found</Text>
            <Text style={styles.emptySubtext}>
              No classes are created in your school yet.
            </Text>
          </View>
        ) : (
          <View style={styles.classesContainer}>
            {classes.map((classItem) => renderClassCard(classItem))}
          </View>
        )}
      </ScrollView>
      
      {renderClassDetailModal()}
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  classesContainer: {
    paddingTop: 16,
  },
  classCard: {
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
  classCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  classAvatar: {
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
  classBasicInfo: {
    flex: 1,
    marginRight: 12,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 2,
  },
  classAdmin: {
    fontSize: 12,
    color: '#FFA502',
    marginBottom: 2,
  },
  classDate: {
    fontSize: 12,
    color: '#8A94A6',
  },
  classCardFooter: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F8',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#8A94A6',
    marginLeft: 6,
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
  detailCard: {
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  detailName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 16,
    textAlign: 'center',
  },
  detailStats: {
    flexDirection: 'row',
    gap: 40,
  },
  detailStatItem: {
    alignItems: 'center',
  },
  detailStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2ED573',
    marginBottom: 4,
  },
  detailStatLabel: {
    fontSize: 12,
    color: '#8A94A6',
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
    fontSize: 15,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 13,
    color: '#8A94A6',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F8',
  },
  listItemText: {
    marginLeft: 12,
    flex: 1,
  },
  listItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3A4276',
    marginBottom: 2,
  },
  listItemEmail: {
    fontSize: 12,
    color: '#8A94A6',
  },
  moreText: {
    fontSize: 13,
    color: '#4E54C8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
  noDataText: {
    fontSize: 14,
    color: '#8A94A6',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});

export default AdminAllClassesDataScreen;