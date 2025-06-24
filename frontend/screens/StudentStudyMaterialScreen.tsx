import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
  Linking,
  Share,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../config/api';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'StudentStudyMaterial'>;

interface Material {
  _id: string;
  documentTitle: string;
  documentCategory: string;
  originalFileName: string;
  fileSize: number;
  downloadCount: number;
  createdAt: string;
  fileUrl?: string;
  mimeType?: string;
  teacherId: {
    _id: string;
    name: string;
    email: string;
  };
  subjectId?: {
    _id: string;
    name: string;
    code: string;
  };
  classId: {
    _id: string;
    name: string;
    section: string;
  };
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
}

interface StudentInfo {
  id: string;
  name: string;
  studentId: string;
  rollNumber: string;
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

interface CategoryStat {
  _id: string;
  count: number;
}

interface SubjectStat {
  _id: string;
  name: string;
  count: number;
}

interface Summary {
  totalMaterials: number;
  categoriesBreakdown: CategoryStat[];
  subjectsBreakdown: SubjectStat[];
}

interface Pagination {
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

interface MaterialsResponse {
  success: boolean;
  materials: Material[];
  pagination: Pagination;
  studentInfo: StudentInfo;
  classInfo: ClassInfo;
  summary: Summary;
  appliedFilters: {
    category: string;
    subjectId: string;
    search: string | null;
  };
}

const CATEGORIES = [
  { value: 'lecture_notes', label: 'Lecture Notes', icon: 'book', color: '#10B981' },
  { value: 'assignment', label: 'Assignment', icon: 'clipboard-list', color: '#EF4444' },
  { value: 'homework', label: 'Homework', icon: 'edit', color: '#F59E0B' },
  { value: 'reference_material', label: 'Reference', icon: 'bookmark', color: '#06B6D4' },
  { value: 'exam_papers', label: 'Exam Papers', icon: 'graduation-cap', color: '#DC2626' },
  { value: 'other', label: 'Other', icon: 'folder', color: '#6B7280' },
];

const PRIMARY_COLOR = '#4F46E5';
const SECONDARY_COLOR = '#10B981';
const WARNING_COLOR = '#F59E0B';
const DANGER_COLOR = '#EF4444';

const StudentStudyMaterialScreen: React.FC<Props> = ({ navigation }) => {
  const [materialsData, setMaterialsData] = useState<MaterialsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState<string>('');
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const isInitialMount = useRef(true);

  const getAuthToken = useCallback(async () => {
    const token = await AsyncStorage.getItem('studentToken');
    if (!token) {
      Alert.alert('Session Expired', 'Please login again');
      navigation.reset({ index: 0, routes: [{ name: 'StudentLogin' }] });
      return null;
    }
    return token;
  }, [navigation]);

  // Memoize the fetch function to prevent infinite loops
  const fetchMaterials = useCallback(async (
    loadMore = false,
    category = selectedCategory,
    subject = selectedSubject,
    search = appliedSearchQuery
  ) => {
    const token = await getAuthToken();
    if (!token) return;

    try {
      if (!loadMore) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const params: any = {
        limit: 20,
        skip: loadMore ? materialsData?.materials.length || 0 : 0,
      };

      if (category !== 'all') {
        params.category = category;
      }

      if (subject !== 'all') {
        params.subjectId = subject;
      }

      if (search.trim()) {
        params.search = search.trim();
      }

      console.log('Fetching materials with params:', params);

      const response = await axios.get(`${API_BASE_URL}/materials/student-class-materials`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (loadMore && materialsData) {
        // Ensure unique keys by filtering out duplicates
        const existingIds = new Set(materialsData.materials.map(m => m._id));
        const newMaterials = response.data.materials.filter((m: Material) => !existingIds.has(m._id));
        
        setMaterialsData(prevData => ({
          ...response.data,
          materials: [...(prevData?.materials || []), ...newMaterials]
        }));
      } else {
        setMaterialsData(response.data);
      }
    } catch (error: any) {
      console.error('Fetch materials error:', error);
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'StudentLogin' }] }) }
        ]);
      } else {
        Alert.alert('Error', error.response?.data?.msg || 'Failed to load study materials');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [getAuthToken]); // Remove dependencies that cause infinite loops

  const startAnimations = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Initial setup
  useEffect(() => {
    navigation.setOptions({
      title: 'Study Materials',
      headerRight: () => (
        <TouchableOpacity onPress={() => setSearchModalVisible(true)} style={styles.searchIconButton}>
          <FontAwesome5 name="search" size={18} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
    
    // Only fetch on initial mount
    if (isInitialMount.current) {
      fetchMaterials(false, 'all', 'all', '');
      startAnimations();
      isInitialMount.current = false;
    }
  }, [navigation, startAnimations]); // Remove fetchMaterials from dependencies

  // Handle filter changes - use separate effect with stable dependencies
  useEffect(() => {
    // Skip if it's the initial mount
    if (isInitialMount.current) return;
    
    console.log('Filter changed:', { selectedCategory, selectedSubject, appliedSearchQuery });
    
    // Reset to first page when filters change
    fetchMaterials(false, selectedCategory, selectedSubject, appliedSearchQuery);
  }, [selectedCategory, selectedSubject, appliedSearchQuery]); // Keep only the state values

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMaterials(false, selectedCategory, selectedSubject, appliedSearchQuery);
  }, [fetchMaterials, selectedCategory, selectedSubject, appliedSearchQuery]);

  const loadMoreMaterials = useCallback(() => {
    if (materialsData?.pagination.hasMore && !loadingMore && !loading) {
      fetchMaterials(true, selectedCategory, selectedSubject, appliedSearchQuery);
    }
  }, [materialsData?.pagination.hasMore, loadingMore, loading, fetchMaterials, selectedCategory, selectedSubject, appliedSearchQuery]);

  // Handle search with proper state management
  const handleSearch = useCallback(() => {
    setSearchModalVisible(false);
    setAppliedSearchQuery(searchQuery); // This will trigger the useEffect above
  }, [searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setAppliedSearchQuery('');
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedCategory('all');
    setSelectedSubject('all');
    setSearchQuery('');
    setAppliedSearchQuery('');
  }, []);

  const openMaterial = useCallback(async (material: Material) => {
    const token = await getAuthToken();
    if (!token) return;

    setDownloading(material._id);

    try {
      const downloadUrl = `${API_BASE_URL}/materials/download/${material._id}`;
      const fileUri = `${FileSystem.documentDirectory}${material.originalFileName}`;
      
      const downloadResult = await FileSystem.downloadAsync(
        downloadUrl,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (downloadResult.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: material.mimeType,
            dialogTitle: material.documentTitle,
          });
        } else {
          Alert.alert('Success', 'File downloaded successfully');
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Open material error:', error);
      Alert.alert('Error', 'Failed to open material');
    } finally {
      setDownloading(null);
    }
  }, [getAuthToken]);

  const shareMaterial = useCallback(async (material: Material) => {
    try {
      await Share.share({
        message: `Check out this study material: ${material.documentTitle}`,
        title: material.documentTitle,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, []);

  const getCategoryInfo = useCallback((category: string) => {
    return CATEGORIES.find(cat => cat.value === category) || CATEGORIES[CATEGORIES.length - 1];
  }, []);

  const getFileIcon = useCallback((fileName: string, mimeType?: string) => {
    const extension = fileName.toLowerCase().split('.').pop();
    const type = mimeType?.toLowerCase();
    
    if (type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '')) {
      return 'image';
    } else if (type === 'application/pdf' || extension === 'pdf') {
      return 'file-pdf';
    } else if (['doc', 'docx'].includes(extension || '') || type?.includes('word')) {
      return 'file-word';
    } else if (['xls', 'xlsx'].includes(extension || '') || type?.includes('sheet')) {
      return 'file-excel';
    } else if (['ppt', 'pptx'].includes(extension || '') || type?.includes('presentation')) {
      return 'file-powerpoint';
    } else if (['txt'].includes(extension || '') || type?.startsWith('text/')) {
      return 'file-alt';
    } else {
      return 'file';
    }
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const renderFilters = useCallback(() => {
    if (!materialsData) return null;

    return (
      <View style={styles.filtersContainer}>
        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategory === 'all' && styles.filterChipActive
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[
              styles.filterChipText,
              selectedCategory === 'all' && styles.filterChipTextActive
            ]}>
              All ({materialsData.pagination.total})
            </Text>
          </TouchableOpacity>
          {materialsData.summary.categoriesBreakdown.map((category) => {
            const categoryInfo = getCategoryInfo(category._id);
            return (
              <TouchableOpacity
                key={category._id}
                style={[
                  styles.filterChip,
                  selectedCategory === category._id && styles.filterChipActive
                ]}
                onPress={() => setSelectedCategory(category._id)}
              >
                <FontAwesome5 
                  name={categoryInfo.icon} 
                  size={12} 
                  color={selectedCategory === category._id ? '#FFFFFF' : categoryInfo.color} 
                  style={styles.filterChipIcon}
                />
                <Text style={[
                  styles.filterChipText,
                  selectedCategory === category._id && styles.filterChipTextActive
                ]}>
                  {categoryInfo.label} ({category.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Subject Filter */}
        {materialsData.summary.subjectsBreakdown.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            <TouchableOpacity
              style={[
                styles.subjectChip,
                selectedSubject === 'all' && styles.subjectChipActive
              ]}
              onPress={() => setSelectedSubject('all')}
            >
              <Text style={[
                styles.subjectChipText,
                selectedSubject === 'all' && styles.subjectChipTextActive
              ]}>
                All Subjects
              </Text>
            </TouchableOpacity>
            {materialsData.summary.subjectsBreakdown.map((subject) => (
              <TouchableOpacity
                key={subject._id}
                style={[
                  styles.subjectChip,
                  selectedSubject === subject._id && styles.subjectChipActive
                ]}
                onPress={() => setSelectedSubject(subject._id)}
              >
                <Text style={[
                  styles.subjectChipText,
                  selectedSubject === subject._id && styles.subjectChipTextActive
                ]}>
                  {subject.name} ({subject.count})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }, [materialsData, selectedCategory, selectedSubject, getCategoryInfo]);

  const renderMaterial = useCallback(({ item }: { item: Material }) => {
    const categoryInfo = getCategoryInfo(item.documentCategory);
    
    return (
      <Animated.View style={[styles.materialCard, { opacity: fadeAnim }]}>
        <TouchableOpacity 
          onPress={() => openMaterial(item)}
          activeOpacity={0.7}
          style={styles.materialTouchable}
        >
          <View style={styles.materialHeader}>
            <View style={[styles.materialIconContainer, { backgroundColor: categoryInfo.color + '15' }]}>
              <FontAwesome5 
                name={getFileIcon(item.originalFileName, item.mimeType)} 
                size={24} 
                color={categoryInfo.color} 
              />
              {downloading === item._id && (
                <View style={styles.downloadingOverlay}>
                  <ActivityIndicator size="small" color={categoryInfo.color} />
                </View>
              )}
            </View>
            <View style={styles.materialInfo}>
              <Text style={styles.materialTitle} numberOfLines={2}>
                {item.documentTitle}
              </Text>
              <View style={styles.categoryBadge}>
                <FontAwesome5 name={categoryInfo.icon} size={10} color={categoryInfo.color} />
                <Text style={[styles.categoryText, { color: categoryInfo.color }]}>
                  {categoryInfo.label}
                </Text>
              </View>
              <Text style={styles.materialDetails}>
                {item.originalFileName} • {formatFileSize(item.fileSize)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                shareMaterial(item);
              }}
              style={styles.shareButton}
            >
              <FontAwesome5 name="share-alt" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.materialFooter}>
            <View style={styles.teacherInfo}>
              <FontAwesome5 name="user" size={12} color="#9CA3AF" />
              <Text style={styles.teacherName}>{item.teacherId.name}</Text>
            </View>
            {item.subjectId && (
              <View style={styles.subjectInfo}>
                <FontAwesome5 name="book" size={12} color="#9CA3AF" />
                <Text style={styles.subjectName}>{item.subjectId.name}</Text>
              </View>
            )}
            <View style={styles.dateInfo}>
              <FontAwesome5 name="calendar" size={12} color="#9CA3AF" />
              <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
            </View>
            <View style={styles.downloadInfo}>
              <FontAwesome5 name="download" size={12} color="#9CA3AF" />
              <Text style={styles.downloadText}>{item.downloadCount}</Text>
            </View>
          </View>

          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap to download and open</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [fadeAnim, downloading, getCategoryInfo, getFileIcon, formatFileSize, formatDate, openMaterial, shareMaterial]);

  const renderSearchModal = useCallback(() => (
    <Modal visible={searchModalVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.searchModalContainer}>
          <View style={styles.searchModalHeader}>
            <Text style={styles.searchModalTitle}>Search Materials</Text>
            <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
              <FontAwesome5 name="times" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchInputContainer}>
            <FontAwesome5 name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title, category, or teacher..."
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={clearSearch}
                style={styles.clearSearch}
              >
                <FontAwesome5 name="times-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.searchActions}>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  ), [searchModalVisible, searchQuery, handleSearch, clearSearch]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading study materials...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!materialsData || materialsData.materials.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.emptyState}>
          <FontAwesome5 name="folder-open" size={64} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>No Study Materials</Text>
          <Text style={styles.emptyDescription}>
            {selectedCategory !== 'all' || selectedSubject !== 'all' || appliedSearchQuery
              ? 'No materials found with the selected filters.'
              : 'Study materials will appear here once uploaded by your teachers.'}
          </Text>
          {(selectedCategory !== 'all' || selectedSubject !== 'all' || appliedSearchQuery) && (
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={clearAllFilters}
            >
              <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
        {renderSearchModal()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <Animated.View style={[
        styles.contentContainer, 
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        <View style={styles.materialsContainer}>
          {renderFilters()}
          <FlatList
            data={materialsData.materials}
            keyExtractor={(item, index) => `${item._id}-${index}`}
            renderItem={renderMaterial}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={PRIMARY_COLOR}
              />
            }
            onEndReached={loadMoreMaterials}
            onEndReachedThreshold={0.1}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                  <Text style={styles.loadingMoreText}>Loading more materials...</Text>
                </View>
              ) : null
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Animated.View>

      {renderSearchModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  searchIconButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
  },
  materialsContainer: {
    flex: 1,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    marginBottom: 8,
  },
  filterScrollView: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  filterChipIcon: {
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subjectChipActive: {
    backgroundColor: SECONDARY_COLOR,
    borderColor: SECONDARY_COLOR,
  },
  subjectChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  subjectChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  materialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  materialTouchable: {
    padding: 16,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  materialIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  downloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 22,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginBottom: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  materialDetails: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '400',
  },
  shareButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  materialFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  subjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  subjectName: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 4,
  },
  downloadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  downloadText: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 4,
  },
  tapHint: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tapHintText: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  clearFiltersButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
  },
  clearFiltersButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: width - 32,
    maxWidth: 400,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1F2937',
  },
  clearSearch: {
    padding: 4,
    marginLeft: 8,
  },
  searchActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  searchButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default StudentStudyMaterialScreen;