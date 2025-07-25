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
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000;

type Props = NativeStackScreenProps<RootStackParamList, 'AdminStudentQueriesScreen'>;

interface Query {
  _id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'submitted' | 'in_review' | 'resolved' | 'rejected' | 'closed';
  studentId: {
    _id: string;
    name: string;
    email: string;
    studentId: string;
  };
  classId: {
    _id: string;
    name: string;
    section: string;
  };
  adminResponse?: {
    message: string;
    respondedBy: {
      _id: string;
      name: string;
      email: string;
    };
    respondedAt: string;
  };
  attachments: Array<{
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
  isUrgent: boolean;
  viewedByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

interface QueryStats {
  submitted: number;
  in_review: number;
  resolved: number;
  rejected: number;
  closed: number;
  total: number;
}

const CATEGORIES = [
  { key: 'all', label: 'All Categories' },
  { key: 'leave_application', label: 'Leave Application' },
  { key: 'document_request', label: 'Document Request' },
  { key: 'bonafide_certificate', label: 'Bonafide Certificate' },
  { key: 'transfer_certificate', label: 'Transfer Certificate' },
  { key: 'fee_related', label: 'Fee Related' },
  { key: 'academic_issue', label: 'Academic Issue' },
  { key: 'disciplinary_matter', label: 'Disciplinary Matter' },
  { key: 'general_inquiry', label: 'General Inquiry' },
  { key: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { key: 'all', label: 'All Status' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'in_review', label: 'In Review' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'closed', label: 'Closed' },
];

const PRIORITY_COLORS = {
  low: '#2ED573',
  medium: '#FFA502',
  high: '#FF6B6B',
  urgent: '#E74C3C',
};

const STATUS_COLORS = {
  submitted: '#3498DB',
  in_review: '#F39C12',
  resolved: '#27AE60',
  rejected: '#E74C3C',
  closed: '#95A5A6',
};

const AdminStudentQueriesScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queries, setQueries] = useState<Query[]>([]);
  const [stats, setStats] = useState<QueryStats>({
    submitted: 0,
    in_review: 0,
    resolved: 0,
    rejected: 0,
    closed: 0,
    total: 0,
  });
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMoreData, setHasMoreData] = useState(true);
  
  // Modal states
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState<string>('in_review');

  // Header configuration
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Student Queries',
      headerStyle: {
        backgroundColor: '#4E54C8',
      },
      headerTintColor: '#FFFFFF',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
  }, [navigation]);

  // Create authenticated API client
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

  // Load queries and stats
  const loadQueriesAndStats = useCallback(async (page = 1, append = false) => {
    try {
      if (!append) {
        setIsLoading(true);
      }

      const apiClient = await getAuthenticatedClient();
      
      // Build query parameters
      const params: any = {
        page,
        limit: 10,
      };
      
      if (searchText.trim()) params.search = searchText.trim();
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (selectedStatus !== 'all') params.status = selectedStatus;

      // Load queries
      const queriesResponse = await apiClient.get('/queries/admin-queries', { params });
      const { queries: newQueries, pagination } = queriesResponse.data;

      if (append) {
        setQueries(prev => [...prev, ...newQueries]);
      } else {
        setQueries(newQueries);
      }

      setCurrentPage(pagination.current);
      setTotalPages(pagination.pages);
      setHasMoreData(pagination.current < pagination.pages);

      // Load stats
      const statsResponse = await apiClient.get('/queries/stats');
      setStats(statsResponse.data.stats);

    } catch (error) {
      console.error('Error loading queries:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please login again.",
          [{ text: "OK", onPress: () => navigation.replace('RoleSelection') }]
        );
      } else {
        Alert.alert("Error", "Failed to load queries. Please try again.");
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [searchText, selectedCategory, selectedStatus, navigation]);

  // Initial load
  useEffect(() => {
    loadQueriesAndStats(1, false);
  }, [loadQueriesAndStats]);

  // Handle search
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    loadQueriesAndStats(1, false);
  }, [loadQueriesAndStats]);

  // Handle filter change
  const handleFilterChange = useCallback((filterType: string, value: string) => {
    if (filterType === 'category') {
      setSelectedCategory(value);
    } else if (filterType === 'status') {
      setSelectedStatus(value);
    }
    setCurrentPage(1);
  }, []);

  // Apply filters
  useEffect(() => {
    const timer = setTimeout(() => {
      loadQueriesAndStats(1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedCategory, selectedStatus]);

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentPage(1);
    loadQueriesAndStats(1, false);
  }, [loadQueriesAndStats]);

  // Load more data
  const loadMoreData = useCallback(() => {
    if (hasMoreData && !isLoading) {
      loadQueriesAndStats(currentPage + 1, true);
    }
  }, [hasMoreData, isLoading, currentPage, loadQueriesAndStats]);

  // Handle query response
  const handleQueryResponse = async () => {
    if (!selectedQuery || !responseText.trim()) {
      Alert.alert("Error", "Please enter a response message.");
      return;
    }

    try {
      setIsLoading(true);
      const apiClient = await getAuthenticatedClient();
      
      await apiClient.put(`/queries/${selectedQuery._id}/status`, {
        status: responseStatus,
        adminResponse: responseText.trim(),
      });

      Alert.alert("Success", "Query response sent successfully.");
      setShowResponseModal(false);
      setResponseText('');
      setSelectedQuery(null);
      
      // Reload queries
      loadQueriesAndStats(1, false);
    } catch (error) {
      console.error('Error responding to query:', error);
      Alert.alert("Error", "Failed to send response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || '#95A5A6';
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#95A5A6';
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Render query item
  const renderQueryItem = ({ item }: { item: Query }) => (
    <TouchableOpacity
      style={[
        styles.queryCard,
        item.isUrgent && styles.urgentQueryCard,
        !item.viewedByAdmin && styles.unreadQueryCard
      ]}
      onPress={() => {
        setSelectedQuery(item);
        setShowQueryModal(true);
      }}
    >
      <View style={styles.queryHeader}>
        <View style={styles.queryHeaderLeft}>
          <Text style={styles.queryTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.queryBadges}>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
              <Text style={styles.badgeText}>{item.priority.toUpperCase()}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.badgeText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
            </View>
            {item.isUrgent && (
              <View style={styles.urgentBadge}>
                <Text style={styles.badgeText}>URGENT</Text>
              </View>
            )}
          </View>
        </View>
        {!item.viewedByAdmin && <View style={styles.unreadDot} />}
      </View>
      
      <Text style={styles.queryDescription} numberOfLines={2}>
        {item.description}
      </Text>
      
      <View style={styles.queryFooter}>
        <View style={styles.studentInfo}>
          <FontAwesome5 name="user" size={12} color="#8A94A6" />
          <Text style={styles.studentName}>{item.studentId.name}</Text>
          <Text style={styles.className}>({item.classId.name} {item.classId.section})</Text>
        </View>
        <Text style={styles.queryDate}>{formatDate(item.createdAt)}</Text>
      </View>
      
      {item.attachments.length > 0 && (
        <View style={styles.attachmentIndicator}>
          <Feather name="paperclip" size={12} color="#8A94A6" />
          <Text style={styles.attachmentCount}>{item.attachments.length} attachment(s)</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Render stats card
  const renderStatsCard = (label: string, count: number, color: string) => (
    <View style={styles.statsCard}>
      <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
        <View style={[styles.statsIcon, { backgroundColor: color }]} />
      </View>
      <Text style={styles.statsCount}>{count}</Text>
      <Text style={styles.statsLabel}>{label}</Text>
    </View>
  );

  if (isLoading && queries.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4E54C8" />
        <Text style={styles.loadingText}>Loading queries...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#4E54C8" />
      
      {/* Search and Filter Header */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={20} color="#8A94A6" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search queries..."
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Feather name="x" size={20} color="#8A94A6" />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Feather name="filter" size={20} color="#4E54C8" />
        </TouchableOpacity>
      </View>

      {/* Filter Options */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Category:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.key}
                    style={[
                      styles.filterChip,
                      selectedCategory === category.key && styles.activeFilterChip
                    ]}
                    onPress={() => handleFilterChange('category', category.key)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      selectedCategory === category.key && styles.activeFilterChipText
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Status:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {STATUS_OPTIONS.map((status) => (
                  <TouchableOpacity
                    key={status.key}
                    style={[
                      styles.filterChip,
                      selectedStatus === status.key && styles.activeFilterChip
                    ]}
                    onPress={() => handleFilterChange('status', status.key)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      selectedStatus === status.key && styles.activeFilterChipText
                    ]}>
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderStatsCard('Submitted', stats.submitted, '#3498DB')}
          {renderStatsCard('In Review', stats.in_review, '#F39C12')}
          {renderStatsCard('Resolved', stats.resolved, '#27AE60')}
          {renderStatsCard('Rejected', stats.rejected, '#E74C3C')}
          {renderStatsCard('Total', stats.total, '#4E54C8')}
        </ScrollView>
      </View>

      {/* Queries List */}
      <FlatList
        data={queries}
        renderItem={renderQueryItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#4E54C8"]}
          />
        }
        onEndReached={loadMoreData}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          hasMoreData && queries.length > 0 ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color="#4E54C8" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="inbox" size={48} color="#BDC3C7" />
              <Text style={styles.emptyText}>No queries found</Text>
              <Text style={styles.emptySubtext}>
                {searchText || selectedCategory !== 'all' || selectedStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Students haven\'t submitted any queries yet'}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Query Detail Modal */}
      <Modal
        visible={showQueryModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowQueryModal(false)}>
              <Feather name="x" size={24} color="#3A4276" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Query Details</Text>
            <TouchableOpacity
              onPress={() => {
                setShowResponseModal(true);
                setResponseStatus(selectedQuery?.status === 'submitted' ? 'in_review' : selectedQuery?.status || 'in_review');
              }}
            >
              <Text style={styles.respondButton}>Respond</Text>
            </TouchableOpacity>
          </View>
          
          {selectedQuery && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.queryDetailHeader}>
                <Text style={styles.queryDetailTitle}>{selectedQuery.title}</Text>
                <View style={styles.queryDetailBadges}>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedQuery.priority) }]}>
                    <Text style={styles.badgeText}>{selectedQuery.priority.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedQuery.status) }]}>
                    <Text style={styles.badgeText}>{selectedQuery.status.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                  {selectedQuery.isUrgent && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.badgeText}>URGENT</Text>
                    </View>
                  )}
                </View>
              </View>
              
              <View style={styles.queryDetailSection}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.queryDetailDescription}>{selectedQuery.description}</Text>
              </View>
              
              <View style={styles.queryDetailSection}>
                <Text style={styles.sectionTitle}>Student Information</Text>
                <View style={styles.studentDetailCard}>
                  <FontAwesome5 name="user" size={16} color="#4E54C8" />
                  <View style={styles.studentDetails}>
                    <Text style={styles.studentDetailName}>{selectedQuery.studentId.name}</Text>
                    <Text style={styles.studentDetailInfo}>
                      {selectedQuery.studentId.email} • ID: {selectedQuery.studentId.studentId}
                    </Text>
                    <Text style={styles.studentDetailClass}>
                      Class: {selectedQuery.classId.name} {selectedQuery.classId.section}
                    </Text>
                  </View>
                </View>
              </View>
              
              {selectedQuery.attachments.length > 0 && (
                <View style={styles.queryDetailSection}>
                  <Text style={styles.sectionTitle}>Attachments</Text>
                  {selectedQuery.attachments.map((attachment, index) => (
                    <View key={index} style={styles.attachmentItem}>
                      <Feather name="paperclip" size={16} color="#8A94A6" />
                      <Text style={styles.attachmentName}>{attachment.fileName}</Text>
                      <Text style={styles.attachmentSize}>
                        ({(attachment.fileSize / 1024).toFixed(1)} KB)
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              {selectedQuery.adminResponse && (
                <View style={styles.queryDetailSection}>
                  <Text style={styles.sectionTitle}>Admin Response</Text>
                  <View style={styles.responseCard}>
                    <Text style={styles.responseMessage}>{selectedQuery.adminResponse.message}</Text>
                    <View style={styles.responseFooter}>
                      <Text style={styles.responseBy}>
                        By: {selectedQuery.adminResponse.respondedBy.name}
                      </Text>
                      <Text style={styles.responseDate}>
                        {formatDate(selectedQuery.adminResponse.respondedAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              
              <View style={styles.queryDetailSection}>
                <Text style={styles.sectionTitle}>Timeline</Text>
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineLabel}>Created:</Text>
                  <Text style={styles.timelineDate}>{formatDate(selectedQuery.createdAt)}</Text>
                </View>
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineLabel}>Last Updated:</Text>
                  <Text style={styles.timelineDate}>{formatDate(selectedQuery.updatedAt)}</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Response Modal */}
      <Modal
        visible={showResponseModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.responseModalOverlay}>
          <View style={styles.responseModalContainer}>
            <View style={styles.responseModalHeader}>
              <Text style={styles.responseModalTitle}>Respond to Query</Text>
              <TouchableOpacity onPress={() => setShowResponseModal(false)}>
                <Feather name="x" size={24} color="#3A4276" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.statusSelectorContainer}>
              <Text style={styles.statusSelectorLabel}>Update Status:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {STATUS_OPTIONS.filter(s => s.key !== 'all').map((status) => (
                  <TouchableOpacity
                    key={status.key}
                    style={[
                      styles.statusSelectorChip,
                      responseStatus === status.key && styles.activeStatusSelectorChip
                    ]}
                    onPress={() => setResponseStatus(status.key)}
                  >
                    <Text style={[
                      styles.statusSelectorChipText,
                      responseStatus === status.key && styles.activeStatusSelectorChipText
                    ]}>
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <TextInput
              style={styles.responseInput}
              placeholder="Enter your response message..."
              value={responseText}
              onChangeText={setResponseText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.responseModalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowResponseModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendButton, (!responseText.trim() || isLoading) && styles.disabledButton]}
                onPress={handleQueryResponse}
                disabled={!responseText.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendButtonText}>Send Response</Text>
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
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#3A4276',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8F9FC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  filterSection: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: '#4E54C8',
  },
  filterChipText: {
    fontSize: 12,
    color: '#8A94A6',
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  statsCard: {
    alignItems: 'center',
    marginHorizontal: 12,
    minWidth: 80,
  },
  statsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statsCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3A4276',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 12,
    color: '#8A94A6',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  queryCard: {
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
  urgentQueryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  unreadQueryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4E54C8',
  },
  queryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  queryHeaderLeft: {
    flex: 1,
  },
  queryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
  },
  queryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  urgentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E74C3C',
    marginRight: 8,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4E54C8',
    marginLeft: 8,
  },
  queryDescription: {
    fontSize: 14,
    color: '#8A94A6',
    lineHeight: 20,
    marginBottom: 12,
  },
  queryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentName: {
    fontSize: 12,
    color: '#3A4276',
    fontWeight: '500',
    marginLeft: 6,
  },
  className: {
    fontSize: 12,
    color: '#8A94A6',
    marginLeft: 4,
  },
  queryDate: {
    fontSize: 12,
    color: '#8A94A6',
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF0',
  },
  attachmentCount: {
    fontSize: 12,
    color: '#8A94A6',
    marginLeft: 6,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
  },
  respondButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  queryDetailHeader: {
    paddingVertical: 20,
  },
  queryDetailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A4276',
    marginBottom: 12,
  },
  queryDetailBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  queryDetailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 12,
  },
  queryDetailDescription: {
    fontSize: 16,
    color: '#3A4276',
    lineHeight: 24,
  },
  studentDetailCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  studentDetails: {
    flex: 1,
    marginLeft: 12,
  },
  studentDetailName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  studentDetailInfo: {
    fontSize: 14,
    color: '#8A94A6',
    marginBottom: 4,
  },
  studentDetailClass: {
    fontSize: 14,
    color: '#8A94A6',
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
    color: '#3A4276',
    marginLeft: 8,
  },
  attachmentSize: {
    fontSize: 12,
    color: '#8A94A6',
  },
  responseCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  responseMessage: {
    fontSize: 16,
    color: '#3A4276',
    lineHeight: 24,
    marginBottom: 12,
  },
  responseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF0',
  },
  responseBy: {
    fontSize: 12,
    color: '#8A94A6',
  },
  responseDate: {
    fontSize: 12,
    color: '#8A94A6',
  },
  timelineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  timelineLabel: {
    fontSize: 14,
    color: '#8A94A6',
  },
  timelineDate: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '500',
  },
  responseModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  responseModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  responseModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF0',
  },
  responseModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
  },
  statusSelectorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statusSelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 12,
  },
  statusSelectorChip: {
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  activeStatusSelectorChip: {
    backgroundColor: '#4E54C8',
  },
  statusSelectorChipText: {
    fontSize: 14,
    color: '#8A94A6',
  },
  activeStatusSelectorChipText: {
    color: '#FFFFFF',
  },
  responseInput: {
    backgroundColor: '#F8F9FC',
    marginHorizontal: 20,
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#3A4276',
    minHeight: 120,
  },
  responseModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FC',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A94A6',
  },
  sendButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#4E54C8',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#BDC3C7',
  },
});

export default AdminStudentQueriesScreen;