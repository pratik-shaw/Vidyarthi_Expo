import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { RootStackParamList } from '../App';
import { STUDENT_API } from '../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

const PRIMARY_COLOR = '#4F46E5';

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
    _id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  }>;
}

type QueryDetailRouteProp = RouteProp<RootStackParamList, 'StudentQueryDetail'>;

const apiClient = axios.create({
  baseURL: STUDENT_API,
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

const StudentQueryDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<QueryDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const { queryId } = route.params;

  const [query, setQuery] = useState<QueryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    fetchQueryDetail();
  }, [queryId]);

  const fetchQueryDetail = async () => {
    try {
      const response = await apiClient.get(`/api/queries/${queryId}`);
      setQuery(response.data.query);
    } catch (error) {
      console.error('Error fetching query detail:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          Alert.alert('Session Expired', 'Please log in again.');
          navigation.replace('StudentLogin');
        } else {
          Alert.alert('Error', 'Failed to load query details.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchQueryDetail();
    setRefreshing(false);
  };

  const getCategoryInfo = (categoryValue: string) => {
    return categories.find(cat => cat.value === categoryValue) || categories[categories.length - 1];
  };

  const getPriorityInfo = (priorityValue: string) => {
    return priorities.find(p => p.value === priorityValue) || priorities[1];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf')) return 'file-text';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'file';
    return 'paperclip';
  };

  const constructFileUrl = (attachmentId: string, fileName: string): string => {
    // Construct the download URL using the attachment ID or query ID
    // Common patterns:
    // Option 1: /api/queries/{queryId}/attachments/{attachmentId}
    // Option 2: /api/attachments/{attachmentId}
    // Option 3: /api/uploads/{fileName}
    
    const baseUrl = STUDENT_API.replace(/\/api\/?$/, '');
    
    // Try the most common pattern first - using attachment ID
    const downloadUrl = `${baseUrl}/api/queries/${queryId}/attachments/${attachmentId}`;
    
    console.log('Constructed download URL:', downloadUrl);
    return downloadUrl;
  };

  const downloadFile = async (attachmentId: string, fileName: string) => {
    try {
      // Check if already downloading
      if (downloadingFiles.has(fileName)) {
        return;
      }

      console.log('Starting download for:', fileName);
      console.log('Attachment ID:', attachmentId);
      
      // Construct the download URL
      const downloadUrl = constructFileUrl(attachmentId, fileName);
      
      console.log('Download URL:', downloadUrl);

      // Mark as downloading
      setDownloadingFiles(prev => new Set(prev).add(fileName));

      // Get token for authenticated request
      const token = await AsyncStorage.getItem('studentToken');
      
      // Create file URI for download
      const fileUri = FileSystem.documentDirectory + fileName;
      
      console.log('Downloading to:', fileUri);

      // Download the file
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const result = await downloadResumable.downloadAsync();
      
      if (!result) {
        throw new Error('Download failed');
      }

      console.log('Download completed:', result.uri);

      // Remove from downloading set
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });

      // Check if sharing is available
      const isSharingAvailable = await Sharing.isAvailableAsync();
      
      if (isSharingAvailable) {
        // Show options to user
        Alert.alert(
          'Download Complete',
          `${fileName} has been downloaded successfully.`,
          [
            {
              text: 'Save to Files',
              onPress: async () => {
                try {
                  // Share the file (allows saving to Files app)
                  await Sharing.shareAsync(result.uri, {
                    mimeType: result.headers?.['content-type'] || 'application/octet-stream',
                    dialogTitle: 'Save File',
                    UTI: result.headers?.['content-type'] || 'public.item',
                  });
                } catch (shareError) {
                  console.error('Error sharing file:', shareError);
                  Alert.alert('Error', 'Failed to save file.');
                }
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert(
          'Download Complete',
          `${fileName} has been saved to app documents.`,
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('Error downloading file:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Remove from downloading set
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });
      
      // Check if it's a 404 error
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        Alert.alert(
          'Download Failed',
          `The file could not be found on the server.\n\nPlease try:\n1. /api/queries/${queryId}/attachments/${attachmentId}\n2. /api/attachments/${attachmentId}\n3. Contact your backend developer to provide the correct endpoint.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Download Failed', 
          `Failed to download ${fileName}\n\nPlease check your internet connection or contact support.`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading query details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!query) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={60} color="#EF4444" />
          <Text style={styles.errorText}>Query not found</Text>
          <TouchableOpacity
            style={styles.backToListButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backToListText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categoryInfo = getCategoryInfo(query.category);
  const priorityInfo = getPriorityInfo(query.priority);
  const statusColor = statusColors[query.status as keyof typeof statusColors];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : 20 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Query Details</Text>
        <View style={{ width: 40 }} />
      </View>

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
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusTextLarge}>
              {query.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          {query.isUrgent && (
            <View style={styles.urgentBadgeLarge}>
              <Feather name="alert-triangle" size={14} color="#DC2626" />
              <Text style={styles.urgentTextLarge}>URGENT</Text>
            </View>
          )}
        </View>

        {/* Title Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.categoryIconLarge, { backgroundColor: `${PRIMARY_COLOR}15` }]}>
              <Feather name={categoryInfo.icon} size={20} color={PRIMARY_COLOR} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>{query.title}</Text>
              <Text style={styles.cardSubtitle}>{categoryInfo.label}</Text>
            </View>
          </View>
        </View>

        {/* Description Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Feather name="align-left" size={18} color={PRIMARY_COLOR} />
            <Text style={styles.sectionTitle}>Description</Text>
          </View>
          <Text style={styles.description}>{query.description}</Text>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Feather name="info" size={18} color={PRIMARY_COLOR} />
            <Text style={styles.sectionTitle}>Details</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Priority</Text>
            <View style={styles.detailValue}>
              <View style={[styles.priorityDot, { backgroundColor: priorityInfo.color }]} />
              <Text style={[styles.detailText, { color: priorityInfo.color }]}>
                {priorityInfo.label}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Class</Text>
            <Text style={styles.detailText}>
              {query.classId.name} - {query.classId.section}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Submitted</Text>
            <Text style={styles.detailText}>{formatDate(query.createdAt)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Updated</Text>
            <Text style={styles.detailText}>{formatDate(query.updatedAt)}</Text>
          </View>
        </View>

        {/* Attachments Card */}
        {query.attachments.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Feather name="paperclip" size={18} color={PRIMARY_COLOR} />
              <Text style={styles.sectionTitle}>
                Attachments ({query.attachments.length})
              </Text>
            </View>

            {query.attachments.map((attachment, index) => {
              const isDownloading = downloadingFiles.has(attachment.fileName);
              
              return (
                <View key={index}>
                  <TouchableOpacity
                    style={[
                      styles.attachmentCard,
                      isDownloading && styles.attachmentCardDownloading
                    ]}
                    onPress={() => downloadFile(attachment._id, attachment.fileName)}
                    activeOpacity={0.7}
                    disabled={isDownloading}
                  >
                    <View style={styles.attachmentIcon}>
                      {isDownloading ? (
                        <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                      ) : (
                        <Feather
                          name={getFileIcon(attachment.mimeType)}
                          size={20}
                          color={PRIMARY_COLOR}
                        />
                      )}
                    </View>
                    <View style={styles.attachmentInfo}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {attachment.fileName}
                      </Text>
                      <Text style={styles.attachmentSize}>
                        {formatFileSize(attachment.fileSize)}
                      </Text>
                      <Text style={styles.attachmentDebug} numberOfLines={1}>
                        ID: {attachment._id}
                      </Text>
                    </View>
                    {isDownloading ? (
                      <Text style={styles.downloadingText}>Downloading...</Text>
                    ) : (
                      <Feather name="download" size={18} color={PRIMARY_COLOR} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Admin Response Card */}
        {query.adminResponse && (
          <View style={[styles.card, styles.responseCard]}>
            <View style={styles.sectionHeader}>
              <Feather name="message-circle" size={18} color="#10B981" />
              <Text style={[styles.sectionTitle, { color: '#10B981' }]}>Admin Response</Text>
            </View>

            <View style={styles.responseContent}>
              <Text style={styles.responseMessage}>{query.adminResponse.message}</Text>
              
              <View style={styles.responseMeta}>
                <View style={styles.responseMetaItem}>
                  <Feather name="user" size={12} color="#8A94A6" />
                  <Text style={styles.responseMetaText}>
                    {query.adminResponse.respondedBy.name}
                  </Text>
                </View>
                <View style={styles.responseMetaItem}>
                  <Feather name="calendar" size={12} color="#8A94A6" />
                  <Text style={styles.responseMetaText}>
                    {formatDate(query.adminResponse.respondedAt)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#F8F9FC',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  statusBadgeLarge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusTextLarge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  urgentBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  urgentTextLarge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIconLarge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3A4276',
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '600',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FC',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachmentCardDownloading: {
    opacity: 0.6,
  },
  attachmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 2,
  },
  attachmentSize: {
    fontSize: 12,
    color: '#8A94A6',
  },
  attachmentDebug: {
    fontSize: 10,
    color: '#EF4444',
    marginTop: 2,
  },
  downloadingText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  responseCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  responseContent: {
    marginTop: 8,
  },
  responseMessage: {
    fontSize: 15,
    color: '#3A4276',
    lineHeight: 24,
    marginBottom: 16,
  },
  responseMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  responseMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  responseMetaText: {
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8A94A6',
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 24,
  },
  backToListButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backToListText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StudentQueryDetailScreen;