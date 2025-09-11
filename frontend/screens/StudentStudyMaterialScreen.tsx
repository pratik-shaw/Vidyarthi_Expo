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
import { FontAwesome5, Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
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
  { value: 'lecture_notes', label: 'Lecture Notes', icon: 'book-open' as const, color: '#10B981' },
  { value: 'assignment', label: 'Assignment', icon: 'clipboard' as const, color: '#EF4444' },
  { value: 'homework', label: 'Homework', icon: 'edit-3' as const, color: '#F59E0B' },
  { value: 'reference_material', label: 'Reference', icon: 'bookmark' as const, color: '#06B6D4' },
  { value: 'exam_papers', label: 'Exam Papers', icon: 'award' as const, color: '#DC2626' },
  { value: 'other', label: 'Other', icon: 'folder' as const, color: '#8A94A6' },
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
      headerStyle: {
        backgroundColor: '#F8F9FC',
      },
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#3A4276',
      },
      headerRight: () => (
        <TouchableOpacity onPress={() => setSearchModalVisible(true)} style={styles.searchIconButton}>
          <Feather name="search" size={20} color={PRIMARY_COLOR} />
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

  const getFileIcon = useCallback((fileName: string, mimeType?: string): keyof typeof Feather.glyphMap => {
    const extension = fileName.toLowerCase().split('.').pop();
    const type = mimeType?.toLowerCase();
    
    if (type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '')) {
      return 'image';
    } else if (type === 'application/pdf' || extension === 'pdf') {
      return 'file-text';
    } else if (['doc', 'docx'].includes(extension || '') || type?.includes('word')) {
      return 'file-text';
    } else if (['xls', 'xlsx'].includes(extension || '') || type?.includes('sheet')) {
      return 'grid';
    } else if (['ppt', 'pptx'].includes(extension || '') || type?.includes('presentation')) {
      return 'monitor';
    } else if (['txt'].includes(extension || '') || type?.startsWith('text/')) {
      return 'file-text';
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
        <Text style={styles.filterSectionTitle}>Categories</Text>
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
                <View style={[styles.filterChipIconContainer, { backgroundColor: categoryInfo.color + '15' }]}>
                  <Feather 
                    name={categoryInfo.icon} 
                    size={12} 
                    color={selectedCategory === category._id ? '#FFFFFF' : categoryInfo.color} 
                  />
                </View>
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
          <>
            <Text style={styles.filterSectionTitle}>Subjects</Text>
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
          </>
        )}

        {/* Active Filters Summary */}
        {(selectedCategory !== 'all' || selectedSubject !== 'all' || appliedSearchQuery) && (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={clearAllFilters}
          >
            <Feather name="x" size={14} color={PRIMARY_COLOR} />
            <Text style={styles.clearFiltersText}>Clear all filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [materialsData, selectedCategory, selectedSubject, appliedSearchQuery, getCategoryInfo, clearAllFilters]);

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
              <Feather 
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
                <Feather name={categoryInfo.icon} size={10} color={categoryInfo.color} />
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
              <Feather name="share" size={16} color="#8A94A6" />
            </TouchableOpacity>
          </View>

          <View style={styles.materialFooter}>
            <View style={styles.infoItem}>
              <Feather name="user" size={12} color="#8A94A6" />
              <Text style={styles.infoText}>{item.teacherId.name}</Text>
            </View>
            {item.subjectId && (
              <View style={styles.infoItem}>
                <Feather name="book" size={12} color="#8A94A6" />
                <Text style={styles.infoText}>{item.subjectId.name}</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Feather name="calendar" size={12} color="#8A94A6" />
              <Text style={styles.infoText}>{formatDate(item.createdAt)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Feather name="download" size={12} color="#8A94A6" />
              <Text style={styles.infoText}>{item.downloadCount}</Text>
            </View>
          </View>

          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap to download and view</Text>
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
              <Feather name="x" size={20} color="#8A94A6" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={16} color="#8A94A6" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title, category, or teacher..."
              placeholderTextColor="#B0B7C3"
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={clearSearch}
                style={styles.clearSearch}
              >
                <Feather name="x-circle" size={16} color="#8A94A6" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.searchActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setSearchModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIconContainer}>
            <Feather name="folder-minus" size={48} color="#8A94A6" />
          </View>
          <Text style={styles.emptyTitle}>No Study Materials</Text>
          <Text style={styles.emptyDescription}>
            {selectedCategory !== 'all' || selectedSubject !== 'all' || appliedSearchQuery
              ? 'No materials found with the selected filters. Try adjusting your search criteria.'
              : 'Study materials will appear here once uploaded by your teachers.'}
          </Text>
          {(selectedCategory !== 'all' || selectedSubject !== 'all' || appliedSearchQuery) && (
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={clearAllFilters}
            >
              <Text style={styles.emptyActionButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
        {renderSearchModal()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      <Animated.View style={[
        styles.contentContainer, 
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        {renderFilters()}
        
        <View style={styles.materialsContainer}>
          <View style={styles.materialsHeader}>
            <Text style={styles.materialsCount}>
              {materialsData.materials.length} of {materialsData.pagination.total} materials
            </Text>
          </View>
          
          <FlatList
            data={materialsData.materials}
            keyExtractor={(item, index) => `${item._id}-${index}`}
            renderItem={renderMaterial}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={PRIMARY_COLOR}
                colors={[PRIMARY_COLOR]}
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
    color: '#3A4276',
    fontWeight: '500',
  },
  searchIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 12,
    opacity: 0.8,
  },
  filterScrollView: {
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    backgroundColor: '#F8F9FC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  filterChipIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3A4276',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  subjectChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    backgroundColor: '#F8F9FC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subjectChipActive: {
    backgroundColor: SECONDARY_COLOR,
    borderColor: SECONDARY_COLOR,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3A4276',
  },
  subjectChipTextActive: {
    color: '#FFFFFF',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 8,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '500',
    color: PRIMARY_COLOR,
    marginLeft: 6,
  },
  materialsContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  materialsHeader: {
    marginBottom: 16,
  },
  materialsCount: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 100,
  },
  materialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  materialTouchable: {
    padding: 20,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  materialIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  downloadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  materialInfo: {
    flex: 1,
    marginRight: 12,
  },
  materialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 22,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  materialDetails: {
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '500',
  },
  shareButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FC',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  materialFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoText: {
    fontSize: 11,
    color: '#8A94A6',
    marginLeft: 4,
    fontWeight: '500',
  },
  tapHint: {
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tapHintText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingMoreText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActionButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  searchModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  clearSearch: {
    padding: 4,
    marginLeft: 8,
  },
  searchActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#F8F9FC',
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A94A6',
  },
  searchButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 16,
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StudentStudyMaterialScreen;