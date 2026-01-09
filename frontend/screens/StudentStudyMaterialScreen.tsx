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
  Share,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const StudentStudyMaterialScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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

      const response = await axios.get(`${API_BASE_URL}/materials/student-class-materials`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (loadMore && materialsData) {
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
  }, [getAuthToken]);

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

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    
    if (isInitialMount.current) {
      fetchMaterials(false, 'all', 'all', '');
      startAnimations();
      isInitialMount.current = false;
    }
  }, [navigation, startAnimations]);

  useEffect(() => {
    if (isInitialMount.current) return;
    fetchMaterials(false, selectedCategory, selectedSubject, appliedSearchQuery);
  }, [selectedCategory, selectedSubject, appliedSearchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMaterials(false, selectedCategory, selectedSubject, appliedSearchQuery);
  }, [fetchMaterials, selectedCategory, selectedSubject, appliedSearchQuery]);

  const loadMoreMaterials = useCallback(() => {
    if (materialsData?.pagination.hasMore && !loadingMore && !loading) {
      fetchMaterials(true, selectedCategory, selectedSubject, appliedSearchQuery);
    }
  }, [materialsData?.pagination.hasMore, loadingMore, loading, fetchMaterials, selectedCategory, selectedSubject, appliedSearchQuery]);


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

  const renderHeader = () => (
    <Animated.View 
      style={[
        styles.header, 
        { 
          opacity: fadeAnim,
          paddingTop: insets.top > 0 ? 0 : 20 
        }
      ]}
    >
      <TouchableOpacity 
        onPress={() => navigation.goBack()} 
        style={styles.headerButton}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color={PRIMARY_COLOR} />
      </TouchableOpacity>
      
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle}>Study Materials</Text>
      </View>
    
    </Animated.View>
  );

  const renderSummaryCard = () => {
    if (!materialsData) return null;

    return (
      <LinearGradient
        colors={[PRIMARY_COLOR, '#6366F1']}
        style={styles.summaryCard}
      >
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryTitle}>Total Materials</Text>
            <Text style={styles.summaryCount}>{materialsData.pagination.total}</Text>
          </View>
          <View style={styles.summaryIconContainer}>
            <Ionicons name="documents" size={32} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.summaryStats}>
          <View style={styles.summaryStatItem}>
            <Ionicons name="folder-open" size={16} color="#FFFFFF" />
            <Text style={styles.summaryStatText}>
              {materialsData.summary.categoriesBreakdown.length} Categories
            </Text>
          </View>
          <View style={styles.summaryStatItem}>
            <Ionicons name="book" size={16} color="#FFFFFF" />
            <Text style={styles.summaryStatText}>
              {materialsData.summary.subjectsBreakdown.length} Subjects
            </Text>
          </View>
        </View>
      </LinearGradient>
    );
  };

  const renderFilters = useCallback(() => {
    if (!materialsData) return null;

    return (
      <View style={styles.filtersContainer}>
        {/* <Text style={styles.filterSectionTitle}>Categories</Text> */}
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
            </View>
          </View>

          <View style={styles.materialDetails}>
            <View style={styles.materialDetailRow}>
              <View style={styles.detailItem}>
                <Ionicons name="person-outline" size={14} color="#8A94A6" />
                <Text style={styles.detailText} numberOfLines={1}>
                  {item.teacherId.name}
                </Text>
              </View>
              {item.subjectId && (
                <View style={styles.detailItem}>
                  <Ionicons name="book-outline" size={14} color="#8A94A6" />
                  <Text style={styles.detailText} numberOfLines={1}>
                    {item.subjectId.name}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.materialDetailRow}>
              <View style={styles.detailItem}>
                <Ionicons name="document-outline" size={14} color="#8A94A6" />
                <Text style={styles.detailText} numberOfLines={1}>
                  {formatFileSize(item.fileSize)}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="calendar-outline" size={14} color="#8A94A6" />
                <Text style={styles.detailText}>
                  {formatDate(item.createdAt)}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="download-outline" size={14} color="#8A94A6" />
                <Text style={styles.detailText}>
                  {item.downloadCount}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.materialFooter}>
            <View style={styles.downloadButton}>
              <Ionicons name="download" size={16} color={PRIMARY_COLOR} />
              <Text style={styles.downloadButtonText}>
                {downloading === item._id ? 'Downloading...' : 'Tap to Download'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                shareMaterial(item);
              }}
              style={styles.shareButton}
            >
              <Feather name="share-2" size={16} color="#8A94A6" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [fadeAnim, downloading, getCategoryInfo, getFileIcon, formatFileSize, formatDate, openMaterial, shareMaterial]);


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
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
        {renderHeader()}
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIconContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#8A94A6" />
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      {renderHeader()}
      
      <Animated.View style={[
        styles.contentContainer, 
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY_COLOR}
              colors={[PRIMARY_COLOR]}
            />
          }
        >
          {/* {renderSummaryCard()} */}
          {renderFilters()}
          
          <View style={styles.materialsContainer}>
            <View style={styles.materialsHeader}>
              <Text style={styles.materialsCount}>
                Showing {materialsData.materials.length} of {materialsData.pagination.total} materials
              </Text>
            </View>
            
            <FlatList
              data={materialsData.materials}
              keyExtractor={(item, index) => `${item._id}-${index}`}
              renderItem={renderMaterial}
              onEndReached={loadMoreMaterials}
              onEndReachedThreshold={0.1}
              scrollEnabled={false}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                    <Text style={styles.loadingMoreText}>Loading more materials...</Text>
                  </View>
                ) : null
              }
              contentContainerStyle={styles.listContent}
            />
          </View>
        </ScrollView>
      </Animated.View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#F8F9FC',
    zIndex: 10,
  },
  headerButton: {
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
  headerSearchButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
    textAlign: 'center',
    marginRight: 38
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
  },
  summaryCard: {
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    fontWeight: '500',
  },
  summaryCount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  summaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 16,
  },
  summaryStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryStatText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  filtersContainer: {
    marginTop: 0,
    paddingHorizontal: 24,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  filterScrollView: {
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
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
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  subjectChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subjectChipActive: {
    backgroundColor: SECONDARY_COLOR,
    borderColor: SECONDARY_COLOR,
  },
  subjectChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  subjectChipTextActive: {
    color: '#FFFFFF',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 6,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  materialsContainer: {
    marginTop: 6,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  materialsHeader: {
    marginBottom: 16,
  },
  materialsCount: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  materialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  materialTouchable: {
    padding: 16,
  },
  materialHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  materialIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  downloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  materialDetails: {
    marginBottom: 12,
  },
  materialDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  materialFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
    color: '#6B7280',
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
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1F2937',
  },
  clearSearchButton: {
    padding: 4,
  },
  searchActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  searchButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
  },
  emptyActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default StudentStudyMaterialScreen;