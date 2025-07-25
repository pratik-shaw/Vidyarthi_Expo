// StudentQueryScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Modal,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import { RootStackParamList } from '../App';
import { STUDENT_API } from '../config/api';

const { width, height } = Dimensions.get('window');
const PRIMARY_COLOR = '#4F46E5';

// Types
interface QueryData {
  _id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  isUrgent: boolean;
  createdAt: string;
  updatedAt: string;
  studentId: {
    name: string;
    email: string;
    studentId: string;
  };
  classId: {
    name: string;
    section: string;
  };
  adminResponse?: {
    message: string;
    respondedBy: {
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
}

interface AttachmentFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

// API Client setup - Updated to use the correct base URL
const apiClient = axios.create({
  baseURL: STUDENT_API, // Keep your existing base URL
  timeout: 30000,
});

apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('studentToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const StudentQueryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  // States
  const [queries, setQueries] = useState<QueryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isUrgent, setIsUrgent] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  
  // Filter states
  const [activeFilter, setActiveFilter] = useState('all');
  const [filteredQueries, setFilteredQueries] = useState<QueryData[]>([]);

  // Categories mapping with proper typing
  const categories = [
    { value: 'leave_application', label: 'Leave Application', icon: 'calendar' as const },
    { value: 'document_request', label: 'Document Request', icon: 'file-text' as const },
    { value: 'bonafide_certificate', label: 'Bonafide Certificate', icon: 'award' as const },
    { value: 'transfer_certificate', label: 'Transfer Certificate', icon: 'send' as const },
    { value: 'fee_related', label: 'Fee Related', icon: 'credit-card' as const },
    { value: 'academic_issue', label: 'Academic Issue', icon: 'book' as const },
    { value: 'disciplinary_matter', label: 'Disciplinary Matter', icon: 'alert-triangle' as const },
    { value: 'general_inquiry', label: 'General Inquiry', icon: 'help-circle' as const },
    { value: 'other', label: 'Other', icon: 'more-horizontal' as const },
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: '#10B981' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high', label: 'High', color: '#EF4444' },
    { value: 'urgent', label: 'Urgent', color: '#DC2626' },
  ];

  const statusColors = {
    submitted: '#3B82F6',
    in_review: '#F59E0B',
    resolved: '#10B981',
    rejected: '#EF4444',
    closed: '#6B7280',
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'in_review', label: 'In Review' },
    { key: 'resolved', label: 'Resolved' },
  ];

  // Fetch queries - FIXED to use correct endpoint
  const fetchQueries = async () => {
    try {
      // Fixed: Use the correct endpoint path that matches your Express routes
      const response = await apiClient.get('/api/queries/my-queries');
      console.log('Queries response:', response.data);
      setQueries(response.data.queries || []);
    } catch (error) {
      console.error('Error fetching queries:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
        
        if (error.response?.status === 401) {
          Alert.alert('Session Expired', 'Please log in again.');
          navigation.replace('StudentLogin');
        } else if (error.response?.status === 404) {
          Alert.alert('Error', 'Query endpoint not found. Please check your API configuration.');
        } else {
          const message = error.response?.data?.msg || 'Failed to load queries. Please try again.';
          Alert.alert('Error', message);
        }
      } else {
        Alert.alert('Error', 'Network error. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter queries based on active filter
  const filterQueries = useCallback(() => {
    if (activeFilter === 'all') {
      setFilteredQueries(queries);
    } else {
      setFilteredQueries(queries.filter(query => query.status === activeFilter));
    }
  }, [queries, activeFilter]);

  // Effects
  useEffect(() => {
    fetchQueries();
  }, []);

  useEffect(() => {
    filterQueries();
  }, [filterQueries]);

  useFocusEffect(
    useCallback(() => {
      fetchQueries();
    }, [])
  );

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchQueries();
    setRefreshing(false);
  };

  // Reset form
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setPriority('medium');
    setIsUrgent(false);
    setAttachments([]);
  };

  // Handle file picker
  const pickDocument = async () => {
    try {
      if (attachments.length >= 3) {
        Alert.alert('Limit Reached', 'You can only attach up to 3 files.');
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        
        // Check file size (5MB limit)
        if (file.size && file.size > 5 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select a file smaller than 5MB.');
          return;
        }

        const newAttachment: AttachmentFile = {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
          size: file.size || 0,
        };

        setAttachments(prev => [...prev, newAttachment]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select file. Please try again.');
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Submit query - FIXED to use correct endpoint
  const submitQuery = async () => {
    if (!title.trim() || !description.trim() || !category) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('priority', priority);
      formData.append('isUrgent', isUrgent.toString());

      // Add attachments
      attachments.forEach((file, index) => {
        formData.append('attachments', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        } as any);
      });

      // Fixed: Use the correct endpoint path that matches your Express routes
      const response = await apiClient.post('/api/queries/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success', 'Query submitted successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setShowCreateModal(false);
            resetForm();
            fetchQueries();
          },
        },
      ]);
    } catch (error) {
      console.error('Error submitting query:', error);
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.msg || 'Failed to submit query.';
        Alert.alert('Error', message);
      } else {
        Alert.alert('Error', 'Failed to submit query. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Get category info
  const getCategoryInfo = (categoryValue: string) => {
    return categories.find(cat => cat.value === categoryValue) || categories[categories.length - 1];
  };

  // Get priority info
  const getPriorityInfo = (priorityValue: string) => {
    return priorities.find(p => p.value === priorityValue) || priorities[1];
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Render query card
  const renderQueryCard = (query: QueryData) => {
    const categoryInfo = getCategoryInfo(query.category);
    const priorityInfo = getPriorityInfo(query.priority);
    const statusColor = statusColors[query.status as keyof typeof statusColors];

    return (
      <TouchableOpacity
        key={query._id}
        style={styles.queryCard}
        onPress={() => {
          // Navigate to query details screen (you can implement this)
          Alert.alert('Query Details', `Query ID: ${query._id}\nStatus: ${query.status}`);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.queryHeader}>
          <View style={styles.queryTitleContainer}>
            <Feather name={categoryInfo.icon} size={16} color={PRIMARY_COLOR} />
            <Text style={styles.queryTitle} numberOfLines={1}>
              {query.title}
            </Text>
            {query.isUrgent && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>URGENT</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{query.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.queryDescription} numberOfLines={2}>
          {query.description}
        </Text>

        <View style={styles.queryMeta}>
          <View style={styles.metaItem}>
            <Feather name="tag" size={12} color="#8A94A6" />
            <Text style={styles.metaText}>{categoryInfo.label}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="flag" size={12} color={priorityInfo.color} />
            <Text style={[styles.metaText, { color: priorityInfo.color }]}>
              {priorityInfo.label}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={12} color="#8A94A6" />
            <Text style={styles.metaText}>{formatDate(query.createdAt)}</Text>
          </View>
        </View>

        {query.attachments.length > 0 && (
          <View style={styles.attachmentIndicator}>
            <Feather name="paperclip" size={12} color="#8A94A6" />
            <Text style={styles.attachmentText}>
              {query.attachments.length} attachment{query.attachments.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {query.adminResponse && (
          <View style={styles.responseIndicator}>
            <Feather name="message-circle" size={12} color="#10B981" />
            <Text style={styles.responseText}>Admin responded</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render create query modal
  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCreateModal(false)}
              activeOpacity={0.7}
            >
              <Feather name="x" size={24} color="#3A4276" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Query</Text>
            <TouchableOpacity
              style={[styles.submitButton, (!title.trim() || !description.trim() || !category) && styles.submitButtonDisabled]}
              onPress={submitQuery}
              disabled={submitting || !title.trim() || !description.trim() || !category}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter query title"
                maxLength={200}
                multiline={false}
              />
              <Text style={styles.charCounter}>{title.length}/200</Text>
            </View>

            {/* Category Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryChip,
                      category === cat.value && styles.categoryChipSelected
                    ]}
                    onPress={() => setCategory(cat.value)}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name={cat.icon}
                      size={14}
                      color={category === cat.value ? '#FFFFFF' : PRIMARY_COLOR}
                    />
                    <Text style={[
                      styles.categoryChipText,
                      category === cat.value && styles.categoryChipTextSelected
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Priority Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.priorityContainer}>
                {priorities.map((p) => (
                  <TouchableOpacity
                    key={p.value}
                    style={[
                      styles.priorityOption,
                      priority === p.value && { backgroundColor: p.color + '20', borderColor: p.color }
                    ]}
                    onPress={() => setPriority(p.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                    <Text style={[
                      styles.priorityText,
                      priority === p.value && { color: p.color, fontWeight: '600' }
                    ]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Urgent Toggle */}
            <View style={styles.inputGroup}>
              <TouchableOpacity
                style={styles.urgentToggle}
                onPress={() => setIsUrgent(!isUrgent)}
                activeOpacity={0.7}
              >
                <View style={styles.urgentToggleLeft}>
                  <Feather name="alert-triangle" size={16} color="#EF4444" />
                  <Text style={styles.urgentToggleText}>Mark as Urgent</Text>
                </View>
                <View style={[styles.toggle, isUrgent && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, isUrgent && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.textInput, styles.textInputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your query in detail..."
                maxLength={2000}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.charCounter}>{description.length}/2000</Text>
            </View>

            {/* Attachments */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Attachments (Optional)</Text>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={pickDocument}
                activeOpacity={0.7}
              >
                <Feather name="paperclip" size={16} color={PRIMARY_COLOR} />
                <Text style={styles.attachmentButtonText}>Add File</Text>
                <Text style={styles.attachmentLimit}>Max 3 files, 5MB each</Text>
              </TouchableOpacity>

              {attachments.map((file, index) => (
                <View key={index} style={styles.attachmentItem}>
                  <View style={styles.attachmentInfo}>
                    <Feather name="file" size={16} color="#8A94A6" />
                    <View style={styles.attachmentDetails}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={styles.attachmentSize}>
                        {formatFileSize(file.size)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeAttachmentButton}
                    onPress={() => removeAttachment(index)}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color="#3A4276" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Queries</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
  <ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false} 
    style={styles.filterTabs}
    contentContainerStyle={styles.filterTabsContent}
  >
    {filters.map((filter) => (
      <TouchableOpacity
        key={filter.key}
        style={[
          styles.filterTab,
          activeFilter === filter.key && styles.filterTabActive
        ]}
        onPress={() => setActiveFilter(filter.key)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.filterTabText,
          activeFilter === filter.key && styles.filterTabTextActive
        ]}>
          {filter.label}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
</View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading queries...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PRIMARY_COLOR]}
              tintColor={PRIMARY_COLOR}
            />
          }
        >
          {filteredQueries.length > 0 ? (
            filteredQueries.map(renderQueryCard)
          ) : (
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={60} color="#8A94A6" style={{ opacity: 0.5 }} />
              <Text style={styles.emptyTitle}>No Queries Found</Text>
              <Text style={styles.emptyMessage}>
                {activeFilter === 'all' 
                  ? "You haven't submitted any queries yet."
                  : `No queries with status "${activeFilter.replace('_', ' ')}" found.`
                }
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowCreateModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.emptyButtonText}>Create Query</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Create Query Modal */}
      {renderCreateModal()}
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#F8F9FC',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
  },
  createButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabs: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterTabActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  queryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  queryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  queryTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  queryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginLeft: 8,
    flex: 1,
  },
  urgentBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  queryDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  queryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  attachmentText: {
    fontSize: 12,
    color: '#8A94A6',
    marginLeft: 4,
  },
  responseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  responseText: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
 modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
  },
  submitButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#3A4276',
    minHeight: 48,
  },
  textInputMultiline: {
    minHeight: 120,
    paddingTop: 12,
  },
  charCounter: {
    fontSize: 12,
    color: '#8A94A6',
    textAlign: 'right',
    marginTop: 4,
  },
  categoryScroll: {
    marginTop: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: PRIMARY_COLOR,
    marginLeft: 6,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  priorityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  urgentToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  urgentToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgentToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3A4276',
    marginLeft: 8,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#EF4444',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  attachmentButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: PRIMARY_COLOR,
    marginLeft: 8,
    marginRight: 12,
  },
  attachmentLimit: {
    fontSize: 12,
    color: '#8A94A6',
  },
  attachmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  attachmentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentDetails: {
    flex: 1,
    marginLeft: 8,
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
  removeAttachmentButton: {
    padding: 4,
  },
  filterContainer: {
    backgroundColor: '#F8F9FC',
    paddingBottom: 16,
  },
  filterTabsContent: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  
});

export default StudentQueryScreen;