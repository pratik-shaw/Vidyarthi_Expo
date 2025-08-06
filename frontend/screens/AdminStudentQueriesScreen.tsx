import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Linking,
  Platform,
  InteractionManager,
  Keyboard,
  BackHandler,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';

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

// Memoized Components
const QueryCard = React.memo(({ item, onPress, onRespond }: { 
  item: Query; 
  onPress: (query: Query) => void;
  onRespond: (query: Query) => void;
}) => {
  const getPriorityColor = useCallback((priority: string) => {
    return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || '#95A5A6';
  }, []);

  const getStatusColor = useCallback((status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#95A5A6';
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  return (
    <TouchableOpacity
      style={[
        styles.queryCard,
        item.isUrgent && styles.urgentQueryCard,
        !item.viewedByAdmin && styles.unreadQueryCard
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
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
      
      {/* Quick Respond Button */}
      <TouchableOpacity
        style={styles.quickRespondButton}
        onPress={(e) => {
          e.stopPropagation();
          onRespond(item);
        }}
        activeOpacity={0.7}
      >
        <Feather name="message-circle" size={16} color="#FFFFFF" />
        <Text style={styles.quickRespondText}>Respond</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const StatsCard = React.memo(({ label, count, color }: { label: string; count: number; color: string }) => (
  <View style={styles.statsCard}>
    <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
      <View style={[styles.statsIcon, { backgroundColor: color }]} />
    </View>
    <Text style={styles.statsCount}>{count}</Text>
    <Text style={styles.statsLabel}>{label}</Text>
  </View>
));

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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Modal states - Simplified approach
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [showQueryModal, setShowQueryModal] = useState(false);
  
  // Response states - Separate from modal
  const [isResponseMode, setIsResponseMode] = useState(false);
  const [responseQuery, setResponseQuery] = useState<Query | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState<string>('in_review');
  const [isSendingResponse, setIsSendingResponse] = useState(false);
  
  const [isDownloading, setIsDownloading] = useState(false);

  // Refs for cleanup
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const apiClientRef = useRef<any>(null);
  const isMountedRef = useRef(true);

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

  // Create authenticated API client with better error handling
  const getAuthenticatedClient = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const client = axios.create({
        baseURL: API_URL,
        timeout: API_TIMEOUT,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Add response interceptor for better error handling
      client.interceptors.response.use(
        (response) => response,
        (error) => {
          if (error.response?.status === 401) {
            // Token expired or invalid
            AsyncStorage.removeItem('token');
            if (isMountedRef.current) {
              navigation.replace('RoleSelection');
            }
          }
          return Promise.reject(error);
        }
      );

      apiClientRef.current = client;
      return client;
    } catch (error) {
      console.error('Error creating authenticated client:', error);
      throw error;
    }
  }, [navigation]);

  // Optimized queries loading with better error handling
  const loadQueriesAndStats = useCallback(async (page = 1, append = false) => {
    if (!isMountedRef.current) return;

    try {
      if (append && isLoadingMore) return;
      
      if (!append) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
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

      // Load queries and stats in parallel for better performance
      const [queriesResponse, statsResponse] = await Promise.all([
        apiClient.get('/queries/admin-queries', { params }),
        page === 1 ? apiClient.get('/queries/stats') : Promise.resolve(null)
      ]);

      if (!isMountedRef.current) return;

      const { queries: newQueries, pagination } = queriesResponse.data;

      if (append) {
        setQueries(prev => {
          // Remove duplicates
          const existingIds = new Set(prev.map(q => q._id));
          const uniqueNewQueries = newQueries.filter((q: Query) => !existingIds.has(q._id));
          return [...prev, ...uniqueNewQueries];
        });
      } else {
        setQueries(newQueries);
      }

      setCurrentPage(pagination.current);
      setTotalPages(pagination.pages);
      setHasMoreData(pagination.current < pagination.pages);

      // Update stats only if we fetched them
      if (statsResponse && statsResponse.data) {
        setStats(statsResponse.data.stats);
      }

    } catch (error) {
      console.error('Error loading queries:', error);
      if (isMountedRef.current) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          Alert.alert(
            "Session Expired",
            "Your session has expired. Please login again.",
            [{ text: "OK", onPress: () => navigation.replace('RoleSelection') }]
          );
        } else {
          const errorMessage = axios.isAxiosError(error) 
            ? error.response?.data?.msg || 'Failed to load queries'
            : 'Network error. Please check your connection.';
          
          Alert.alert("Error", errorMessage);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setRefreshing(false);
        setIsLoadingMore(false);
      }
    }
  }, [searchText, selectedCategory, selectedStatus, navigation, getAuthenticatedClient, isLoadingMore]);

  // Debounced search
  const debouncedSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setCurrentPage(1);
        loadQueriesAndStats(1, false);
      }
    }, 500);
  }, [loadQueriesAndStats]);

  // Handle search with debouncing
  useEffect(() => {
    debouncedSearch();
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText, debouncedSearch]);

  // Initial load
  useEffect(() => {
    const loadData = () => {
      InteractionManager.runAfterInteractions(() => {
        loadQueriesAndStats(1, false);
      });
    };

    loadData();
  }, []);

  // Handle filter change with optimization
  const handleFilterChange = useCallback((filterType: string, value: string) => {
    if (filterType === 'category') {
      setSelectedCategory(value);
    } else if (filterType === 'status') {
      setSelectedStatus(value);
    }
    setCurrentPage(1);
    
    setTimeout(() => {
      if (isMountedRef.current) {
        loadQueriesAndStats(1, false);
      }
    }, 100);
  }, [loadQueriesAndStats]);

  // Handle refresh
  const onRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    setCurrentPage(1);
    loadQueriesAndStats(1, false);
  }, [loadQueriesAndStats, refreshing]);

  // Load more data
  const loadMoreData = useCallback(() => {
    if (hasMoreData && !isLoading && !isLoadingMore && currentPage < totalPages) {
      loadQueriesAndStats(currentPage + 1, true);
    }
  }, [hasMoreData, isLoading, isLoadingMore, currentPage, totalPages, loadQueriesAndStats]);

  // Enhanced download attachment
  const downloadAttachment = useCallback(async (queryId: string, attachmentIndex: number, fileName: string) => {
    if (isDownloading) return;

    try {
      setIsDownloading(true);
      
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const downloadUrl = `${API_URL}/queries/${queryId}/attachments/${attachmentIndex}`;
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const downloadPath = `${FileSystem.documentDirectory}${sanitizedFileName}`;
      
      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        downloadPath,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (downloadResult.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/octet-stream',
            dialogTitle: 'Open with...',
            UTI: 'public.item',
          });
        } else {
          if (Platform.OS === 'ios') {
            Alert.alert(
              'Download Complete',
              `File downloaded: ${fileName}`,
              [
                {
                  text: 'OK',
                  onPress: () => {
                    Linking.canOpenURL(downloadResult.uri).then(supported => {
                      if (supported) {
                        Linking.openURL(downloadResult.uri);
                      }
                    });
                  },
                },
              ]
            );
          } else {
            try {
              const { status } = await MediaLibrary.requestPermissionsAsync();
              if (status === 'granted') {
                await MediaLibrary.createAssetAsync(downloadResult.uri);
                Alert.alert('Success', `File downloaded: ${fileName}`);
              } else {
                Alert.alert('Success', `File downloaded: ${fileName}`);
              }
            } catch (permError) {
              Alert.alert('Success', `File downloaded: ${fileName}`);
            }
          }
        }
      } else {
        throw new Error(`Download failed with status: ${downloadResult.status}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.msg || 'Failed to download file'
        : error instanceof Error 
        ? error.message 
        : 'Failed to download file';
        
      Alert.alert('Download Error', errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  // Simplified response handler
  const handleQueryResponse = useCallback(async () => {
    if (!responseQuery) {
      Alert.alert("Error", "No query selected.");
      return;
    }

    const trimmedResponse = responseText.trim();
    if (!trimmedResponse) {
      Alert.alert("Error", "Please enter a response message.");
      return;
    }

    if (trimmedResponse.length < 10) {
      Alert.alert("Error", "Response message should be at least 10 characters long.");
      return;
    }

    try {
      setIsSendingResponse(true);
      const apiClient = await getAuthenticatedClient();
      
      const response = await apiClient.put(`/queries/${responseQuery._id}/status`, {
        status: responseStatus,
        adminResponse: trimmedResponse,
      });

      if (response.status === 200) {
        // Update the query in the local state
        setQueries(prevQueries => 
          prevQueries.map(query => 
            query._id === responseQuery._id 
              ? { 
                  ...query, 
                  status: responseStatus as any,
                  adminResponse: {
                    message: trimmedResponse,
                    respondedBy: {
                      _id: 'current_admin',
                      name: 'You',
                      email: ''
                    },
                    respondedAt: new Date().toISOString()
                  }
                }
              : query
          )
        );

        Alert.alert("Success", "Query response sent successfully.", [
          {
            text: "OK",
            onPress: () => {
              // Close response mode
              setIsResponseMode(false);
              setResponseQuery(null);
              setResponseText('');
              setResponseStatus('in_review');
              
              // Refresh data
              setTimeout(() => {
                if (isMountedRef.current) {
                  loadQueriesAndStats(1, false);
                }
              }, 500);
            }
          }
        ]);
      }
    } catch (error) {
      console.error('Error responding to query:', error);
      const errorMessage = axios.isAxiosError(error)
        ? error.response?.data?.msg || 'Failed to send response'
        : 'Network error. Please check your connection.';
        
      Alert.alert("Error", errorMessage);
    } finally {
      setIsSendingResponse(false);
    }
  }, [responseQuery, responseText, responseStatus, getAuthenticatedClient, loadQueriesAndStats]);

  // Handle query selection
  const handleQueryPress = useCallback((query: Query) => {
    setSelectedQuery(query);
    setShowQueryModal(true);
  }, []);

  // Handle response mode - Simplified approach
  const handleRespondPress = useCallback((query: Query) => {
    setResponseQuery(query);
    setResponseStatus(query.status === 'submitted' ? 'in_review' : query.status);
    setResponseText('');
    setIsResponseMode(true);
    
    // If modal is open, close it
    if (showQueryModal) {
      setShowQueryModal(false);
    }
  }, [showQueryModal]);

  // Cancel response mode
  const handleCancelResponse = useCallback(() => {
    setIsResponseMode(false);
    setResponseQuery(null);
    setResponseText('');
    setResponseStatus('in_review');
  }, []);

  // Handle back button for Android
  useEffect(() => {
    const backAction = () => {
      if (isResponseMode) {
        handleCancelResponse();
        return true;
      }
      if (showQueryModal) {
        setShowQueryModal(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isResponseMode, showQueryModal, handleCancelResponse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (apiClientRef.current) {
        apiClientRef.current = null;
      }
    };
  }, []);

  // Memoized components
  const memoizedStats = useMemo(() => (
    <View style={styles.statsContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <StatsCard label="Submitted" count={stats.submitted} color="#3498DB" />
        <StatsCard label="In Review" count={stats.in_review} color="#F39C12" />
        <StatsCard label="Resolved" count={stats.resolved} color="#27AE60" />
        <StatsCard label="Rejected" count={stats.rejected} color="#E74C3C" />
        <StatsCard label="Total" count={stats.total} color="#4E54C8" />
      </ScrollView>
    </View>
  ), [stats]);

  const memoizedFilters = useMemo(() => showFilters && (
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
            {[{ key: 'all', label: 'All Status' }, ...STATUS_OPTIONS].map((status) => (
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
  ), [showFilters, selectedCategory, selectedStatus, handleFilterChange]);

  // Loading screen
  if (isLoading && queries.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4E54C8" />
        <Text style={styles.loadingText}>Loading queries...</Text>
      </SafeAreaView>
    );
  }

  // Response Mode Screen
  if (isResponseMode && responseQuery) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#4E54C8" />
        
        {/* Response Header */}
        <View style={styles.responseHeader}>
          <TouchableOpacity onPress={handleCancelResponse}>
            <Feather name="arrow-left" size={24} color="#3A4276" />
          </TouchableOpacity>
          <Text style={styles.responseTitle}>Respond to Query</Text>
          <TouchableOpacity
            style={[styles.sendButton, isSendingResponse && styles.disabledButton]}
            onPress={handleQueryResponse}
            disabled={isSendingResponse}
          >
            {isSendingResponse ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.responseContent} keyboardShouldPersistTaps="handled">
          {/* Query Preview */}
          <View style={styles.queryPreview}>
            <Text style={styles.queryPreviewTitle}>{responseQuery.title}</Text>
            <Text style={styles.queryPreviewDescription}>
              {responseQuery.description}
            </Text>
            <View style={styles.queryPreviewMeta}>
              <Text style={styles.queryPreviewStudent}>
                By: {responseQuery.studentId.name} ({responseQuery.classId.name} {responseQuery.classId.section})
              </Text>
            </View>
          </View>

          {/* Status Update */}
          <View style={styles.responseSection}>
            <Text style={styles.responseLabel}>Update Status</Text>
            <View style={styles.statusOptionsContainer}>
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status.key}
                  style={[
                    styles.statusOption,
                    responseStatus === status.key && styles.activeStatusOption
                  ]}
                  onPress={() => setResponseStatus(status.key)}
                >
                  <Text style={[
                    styles.statusOptionText,
                    responseStatus === status.key && styles.activeStatusOptionText
                  ]}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Response Message */}
          <View style={styles.responseSection}>
            <Text style={styles.responseLabel}>Response Message</Text>
            <TextInput
              style={styles.responseTextInput}
              placeholder="Enter your response to the student..."
              value={responseText}
              onChangeText={setResponseText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoCapitalize="sentences"
              autoCorrect={true}
            />
            <Text style={styles.characterCount}>
              {responseText.length} characters (minimum 10 required)
            </Text>
          </View>
        </ScrollView>
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
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Feather name="x" size={20} color="#8A94A6" />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}>
          <Feather name="filter" size={20} color={showFilters ? "#FFFFFF" : "#8A94A6"} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {memoizedFilters}

      {/* Stats */}
      {memoizedStats}

      {/* Queries List */}
      <View style={styles.contentContainer}>
        {queries.length === 0 && !isLoading ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="inbox" size={64} color="#DDD" />
            <Text style={styles.emptyText}>No queries found</Text>
            <Text style={styles.emptySubText}>
              {searchText || selectedCategory !== 'all' || selectedStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Students haven\'t submitted any queries yet'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={queries}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <QueryCard
                item={item}
                onPress={handleQueryPress}
                onRespond={handleRespondPress}
              />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4E54C8']} />
            }
            onEndReached={loadMoreData}
            onEndReachedThreshold={0.3}
            ListFooterComponent={() =>
              isLoadingMore ? (
                <View style={styles.loadMoreContainer}>
                  <ActivityIndicator size="small" color="#4E54C8" />
                  <Text style={styles.loadMoreText}>Loading more queries...</Text>
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={10}
          />
        )}
      </View>

      {/* Query Detail Modal */}
      <Modal
        visible={showQueryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowQueryModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowQueryModal(false)}>
              <Feather name="x" size={24} color="#3A4276" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Query Details</Text>
            <TouchableOpacity
              style={styles.respondModalButton}
              onPress={() => {
                if (selectedQuery) {
                  handleRespondPress(selectedQuery);
                }
              }}
            >
              <Text style={styles.respondModalButtonText}>Respond</Text>
            </TouchableOpacity>
          </View>

          {selectedQuery && (
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Query Header */}
              <View style={styles.modalQueryHeader}>
                <Text style={styles.modalQueryTitle}>{selectedQuery.title}</Text>
                <View style={styles.modalQueryBadges}>
                  <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[selectedQuery.priority] }]}>
                    <Text style={styles.badgeText}>{selectedQuery.priority.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[selectedQuery.status] }]}>
                    <Text style={styles.badgeText}>{selectedQuery.status.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                  {selectedQuery.isUrgent && (
                    <View style={styles.urgentBadge}>
                      <Text style={styles.badgeText}>URGENT</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Student Information */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Student Information</Text>
                <View style={styles.studentDetails}>
                  <View style={styles.studentDetailRow}>
                    <FontAwesome5 name="user" size={16} color="#8A94A6" />
                    <Text style={styles.studentDetailText}>{selectedQuery.studentId.name}</Text>
                  </View>
                  <View style={styles.studentDetailRow}>
                    <MaterialIcons name="email" size={16} color="#8A94A6" />
                    <Text style={styles.studentDetailText}>{selectedQuery.studentId.email}</Text>
                  </View>
                  <View style={styles.studentDetailRow}>
                    <FontAwesome5 name="id-card" size={16} color="#8A94A6" />
                    <Text style={styles.studentDetailText}>ID: {selectedQuery.studentId.studentId}</Text>
                  </View>
                  <View style={styles.studentDetailRow}>
                    <FontAwesome5 name="graduation-cap" size={16} color="#8A94A6" />
                    <Text style={styles.studentDetailText}>
                      {selectedQuery.classId.name} {selectedQuery.classId.section}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Query Details */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Query Details</Text>
                <Text style={styles.queryDescription}>{selectedQuery.description}</Text>
                
                <View style={styles.queryMetadata}>
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Category:</Text>
                    <Text style={styles.metadataValue}>
                      {CATEGORIES.find(c => c.key === selectedQuery.category)?.label || selectedQuery.category}
                    </Text>
                  </View>
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Submitted:</Text>
                    <Text style={styles.metadataValue}>
                      {new Date(selectedQuery.createdAt).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Last Updated:</Text>
                    <Text style={styles.metadataValue}>
                      {new Date(selectedQuery.updatedAt).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Attachments */}
              {selectedQuery.attachments.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Attachments ({selectedQuery.attachments.length})</Text>
                  {selectedQuery.attachments.map((attachment, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.attachmentItem}
                      onPress={() => downloadAttachment(selectedQuery._id, index, attachment.fileName)}
                      disabled={isDownloading}
                    >
                      <View style={styles.attachmentInfo}>
                        <Feather name="file" size={20} color="#4E54C8" />
                        <View style={styles.attachmentDetails}>
                          <Text style={styles.attachmentName} numberOfLines={1}>
                            {attachment.fileName}
                          </Text>
                          <Text style={styles.attachmentSize}>
                            {(attachment.fileSize / 1024).toFixed(1)} KB • {attachment.mimeType}
                          </Text>
                        </View>
                      </View>
                      {isDownloading ? (
                        <ActivityIndicator size="small" color="#4E54C8" />
                      ) : (
                        <Feather name="download" size={20} color="#4E54C8" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Admin Response */}
              {selectedQuery.adminResponse && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Admin Response</Text>
                  <View style={styles.adminResponseContainer}>
                    <Text style={styles.adminResponseMessage}>
                      {selectedQuery.adminResponse.message}
                    </Text>
                    <View style={styles.adminResponseMeta}>
                      <Text style={styles.adminResponseBy}>
                        By: {selectedQuery.adminResponse.respondedBy.name}
                      </Text>
                      <Text style={styles.adminResponseDate}>
                        {new Date(selectedQuery.adminResponse.respondedAt).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.respondButton}
                  onPress={() => {
                    if (selectedQuery) {
                      handleRespondPress(selectedQuery);
                    }
                  }}
                >
                  <Feather name="message-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.respondButtonText}>
                    {selectedQuery.adminResponse ? 'Update Response' : 'Respond'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#3A4276',
    marginLeft: 8,
    marginRight: 8,
  },
  filterButton: {
    backgroundColor: '#4E54C8',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    paddingVertical: 8,
  },
  filterSection: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  activeFilterChip: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  filterChipText: {
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    paddingVertical: 16,
  },
  statsCard: {
    alignItems: 'center',
    paddingHorizontal: 20,
    minWidth: 80,
  },
  statsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statsIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8A94A6',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#B8C2CC',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    paddingVertical: 8,
  },
  queryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  urgentQueryCard: {
    borderColor: '#E74C3C',
    borderWidth: 2,
  },
  unreadQueryCard: {
    backgroundColor: '#F8F9FF',
    borderColor: '#4E54C8',
  },
  queryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
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
    gap: 6,
  },
  priorityBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  urgentBadge: {
    backgroundColor: '#E74C3C',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    marginTop: 4,
  },
  queryDescription: {
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 20,
    marginBottom: 12,
  },
  queryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentName: {
    fontSize: 12,
    color: '#8A94A6',
    marginLeft: 6,
    fontWeight: '500',
  },
  className: {
    fontSize: 12,
    color: '#B8C2CC',
    marginLeft: 4,
  },
  queryDate: {
    fontSize: 12,
    color: '#8A94A6',
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  attachmentCount: {
    fontSize: 12,
    color: '#8A94A6',
    marginLeft: 6,
  },
  quickRespondButton: {
    backgroundColor: '#4E54C8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  quickRespondText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  loadMoreContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8A94A6',
  },
  // Modal Styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
  },
  respondModalButton: {
    backgroundColor: '#4E54C8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  respondModalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalQueryHeader: {
    marginBottom: 24,
  },
  modalQueryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
    marginBottom: 12,
  },
  modalQueryBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 12,
  },
  studentDetails: {
    gap: 12,
  },
  studentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentDetailText: {
    fontSize: 14,
    color: '#6C757D',
    marginLeft: 12,
  },
  queryMetadata: {
    marginTop: 16,
    gap: 8,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metadataLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A94A6',
  },
  metadataValue: {
    fontSize: 14,
    color: '#3A4276',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attachmentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3A4276',
  },
  attachmentSize: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 2,
  },
  adminResponseContainer: {
    backgroundColor: '#F8F9FF',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4E54C8',
  },
  adminResponseMessage: {
    fontSize: 14,
    color: '#3A4276',
    lineHeight: 20,
    marginBottom: 12,
  },
  adminResponseMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adminResponseBy: {
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '500',
  },
  adminResponseDate: {
    fontSize: 12,
    color: '#8A94A6',
  },
  modalActions: {
    paddingVertical: 16,
  },
  respondButton: {
    backgroundColor: '#4E54C8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  respondButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Response Mode Styles
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  responseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
  },
  sendButton: {
    backgroundColor: '#4E54C8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#B8C2CC',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  responseContent: {
    flex: 1,
    padding: 16,
  },
  queryPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  queryPreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
  },
  queryPreviewDescription: {
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 20,
    marginBottom: 12,
  },
  queryPreviewMeta: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
  },
  queryPreviewStudent: {
    fontSize: 12,
    color: '#8A94A6',
  },
  responseSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  responseLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 12,
  },
  statusOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
  },
  activeStatusOption: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  statusOptionText: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  activeStatusOptionText: {
    color: '#FFFFFF',
  },
  responseTextInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
    color: '#3A4276',
    backgroundColor: '#F8F9FA',
    minHeight: 120,
  },
  characterCount: {
    fontSize: 12,
    color: '#8A94A6',
    textAlign: 'right',
    marginTop: 8,
  },
});

export default AdminStudentQueriesScreen;