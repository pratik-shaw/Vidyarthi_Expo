import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherPostMaterial'>;

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
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

const CATEGORIES = [
  { value: 'lecture_notes', label: 'Lecture Notes' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'homework', label: 'Homework' },
  { value: 'reference_material', label: 'Reference' },
  { value: 'exam_papers', label: 'Exam Papers' },
  { value: 'other', label: 'Other' },
];

const TeacherPostMaterialScreen: React.FC<Props> = ({ route, navigation }) => {
  const { classId, className, subjectId } = route.params;
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  
  // Form states
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `Materials - ${className}${classInfo?.section ? ` (${classInfo.section})` : ''}`,
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#3A4276',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
      headerRight: () => (
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
          <FontAwesome5 name="plus" size={18} color="#1CB5E0" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, className, classInfo?.section]);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const getAuthToken = async () => {
    const token = await AsyncStorage.getItem('teacherToken');
    if (!token) {
      Alert.alert('Session Expired', 'Please login again');
      navigation.reset({ index: 0, routes: [{ name: 'TeacherLogin' }] });
      return null;
    }
    return token;
  };

  const fetchMaterials = async () => {
    const token = await getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/materials/my-materials`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { classId, subjectId },
      });
      setMaterials(response.data.materials || []);
      
      // Extract class info from response if available
      if (response.data.classInfo) {
        setClassInfo(response.data.classInfo);
      }
    } catch (error) {
      console.error('Fetch materials error:', error);
      Alert.alert('Error', 'Failed to load materials');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openMaterial = async (material: Material) => {
    const token = await getAuthToken();
    if (!token) return;

    // Show loading indicator
    setDownloading(material._id);

    try {
      // Check if it's an image that can be viewed directly
      const isImage = material.mimeType?.startsWith('image/') || 
                     material.originalFileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
      
      // Check if it's a PDF
      const isPdf = material.mimeType === 'application/pdf' || 
                   material.originalFileName.toLowerCase().endsWith('.pdf');

      if (isImage || isPdf) {
        // For images and PDFs, try to open directly with the system viewer
        const downloadUrl = `${API_BASE_URL}/materials/download/${material._id}`;
        
        // Download the file first
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
          // Try to open with system viewer
          const canOpen = await Sharing.isAvailableAsync();
          if (canOpen) {
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
      } else {
        // For other file types, show options
        Alert.alert(
          material.documentTitle,
          'Choose an action:',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Download', 
              onPress: () => downloadMaterial(material)
            },
            { 
              text: 'Open with...', 
              onPress: () => openWithExternalApp(material)
            },
          ]
        );
      }
    } catch (error) {
      console.error('Open material error:', error);
      Alert.alert('Error', 'Failed to open material. Would you like to download it instead?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: () => downloadMaterial(material) },
      ]);
    } finally {
      setDownloading(null);
    }
  };

  const downloadMaterial = async (material: Material) => {
    const token = await getAuthToken();
    if (!token) return;

    try {
      setDownloading(material._id);
      
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
        Alert.alert(
          'Download Complete',
          `${material.documentTitle} has been downloaded successfully.`,
          [
            { text: 'OK' },
            { 
              text: 'Open', 
              onPress: () => Sharing.shareAsync(downloadResult.uri)
            },
          ]
        );
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download material');
    } finally {
      setDownloading(null);
    }
  };

  const openWithExternalApp = async (material: Material) => {
    const token = await getAuthToken();
    if (!token) return;

    try {
      setDownloading(material._id);
      
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
        // Share the file which will show "Open with..." options
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: material.mimeType,
          dialogTitle: `Open ${material.documentTitle} with...`,
        });
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Open with external app error:', error);
      Alert.alert('Error', 'Failed to open material');
    } finally {
      setDownloading(null);
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        if (file.size && file.size > 50 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 50MB');
          return;
        }
        setSelectedFile(file);
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const file = {
          uri: asset.uri,
          name: `image_${Date.now()}.jpg`,
          type: 'image/jpeg',
          size: asset.fileSize || 0,
        };
        setSelectedFile(file);
        setTitle(`Image_${Date.now()}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadMaterial = async () => {
    if (!selectedFile || !title.trim() || !category) {
      Alert.alert('Missing Information', 'Please fill all required fields');
      return;
    }

    const token = await getAuthToken();
    if (!token) return;

    try {
      setUploading(true);
      
      console.log('Upload attempt:', {
        classId,
        subjectId,
        title: title.trim(),
        category,
        fileName: selectedFile.name,
        fileSize: selectedFile.size
      });
      
      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        type: selectedFile.type || selectedFile.mimeType || 'application/octet-stream',
        name: selectedFile.name,
      } as any);
      formData.append('documentTitle', title.trim());
      formData.append('documentCategory', category);

      const response = await axios.post(
        `${API_BASE_URL}/materials/upload/${classId}/${subjectId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000,
        }
      );

      console.log('Upload successful:', response.data);
      Alert.alert('Success', 'Material uploaded successfully!');
      resetForm();
      setModalVisible(false);
      fetchMaterials();
      
    } catch (error: any) {
      console.error('Upload error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      let errorMessage = 'Upload failed';
      
      if (error.response?.status === 403) {
        errorMessage = error.response?.data?.error || 'Access denied. Please check your permissions.';
      } else if (error.response?.status === 400) {
        errorMessage = error.response?.data?.msg || 'Invalid request data';
      } else if (error.response?.data?.msg) {
        errorMessage = error.response.data.msg;
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const deleteMaterial = (id: string) => {
    Alert.alert(
      'Delete Material',
      'Are you sure you want to delete this material?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const token = await getAuthToken();
            if (!token) return;

            try {
              await axios.delete(`${API_BASE_URL}/materials/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              Alert.alert('Success', 'Material deleted');
              fetchMaterials();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete material');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setSelectedFile(null);
    setTitle('');
    setCategory('');
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getFileIcon = (fileName: string, mimeType?: string) => {
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
  };

  const renderMaterial = ({ item }: { item: Material }) => (
    <TouchableOpacity 
      style={styles.materialCard}
      onPress={() => openMaterial(item)}
      activeOpacity={0.7}
    >
      <View style={styles.materialHeader}>
        <View style={styles.materialIconContainer}>
          <FontAwesome5 
            name={getFileIcon(item.originalFileName, item.mimeType)} 
            size={24} 
            color="#1CB5E0" 
          />
          {downloading === item._id && (
            <View style={styles.downloadingOverlay}>
              <ActivityIndicator size="small" color="#1CB5E0" />
            </View>
          )}
        </View>
        <View style={styles.materialInfo}>
          <Text style={styles.materialTitle} numberOfLines={2}>
            {item.documentTitle}
          </Text>
          <Text style={styles.materialCategory}>
            {CATEGORIES.find(cat => cat.value === item.documentCategory)?.label}
          </Text>
          <Text style={styles.materialDetails}>
            {item.originalFileName} • {formatFileSize(item.fileSize)}
          </Text>
          <Text style={styles.materialDate}>
            {formatDate(item.createdAt)} • {item.downloadCount} downloads
          </Text>
        </View>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            deleteMaterial(item._id);
          }}
          style={styles.deleteButton}
        >
          <FontAwesome5 name="trash" size={16} color="#F7685B" />
        </TouchableOpacity>
      </View>
      <View style={styles.tapHint}>
        <Text style={styles.tapHintText}>Tap to open</Text>
      </View>
    </TouchableOpacity>
  );

  const renderUploadModal = () => (
    <Modal visible={modalVisible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload Material</Text>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <FontAwesome5 name="times" size={20} color="#8A94A6" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {/* File Selection */}
            <View style={styles.section}>
              <Text style={styles.label}>Select File *</Text>
              <View style={styles.fileButtons}>
                <TouchableOpacity style={styles.fileButton} onPress={pickFile}>
                  <FontAwesome5 name="file" size={20} color="#1CB5E0" />
                  <Text style={styles.fileButtonText}>Document</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fileButton} onPress={pickImage}>
                  <FontAwesome5 name="image" size={20} color="#1CB5E0" />
                  <Text style={styles.fileButtonText}>Image</Text>
                </TouchableOpacity>
              </View>
              {selectedFile && (
                <View style={styles.selectedFile}>
                  <FontAwesome5 name="check-circle" size={16} color="#38EF7D" />
                  <Text style={styles.selectedFileName}>{selectedFile.name}</Text>
                </View>
              )}
            </View>

            {/* Title Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter material title"
                maxLength={100}
                placeholderTextColor="#B0B7C3"
              />
            </View>

            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={styles.label}>Category *</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryChip,
                      category === cat.value && styles.categoryChipSelected
                    ]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      category === cat.value && styles.categoryChipTextSelected
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { setModalVisible(false); resetForm(); }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
              onPress={uploadMaterial}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1CB5E0" />
          <Text style={styles.loadingText}>Loading materials...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
      
      {materials.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome5 name="folder-open" size={64} color="#B0B7C3" />
          <Text style={styles.emptyTitle}>No Materials</Text>
          <Text style={styles.emptyDescription}>
            Upload your first material for {className}
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setModalVisible(true)}
          >
            <FontAwesome5 name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>Upload Material</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={materials}
          keyExtractor={(item) => item._id}
          renderItem={renderMaterial}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchMaterials();
              }}
              colors={['#1CB5E0', '#38EF7D']}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {renderUploadModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  addButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(28, 181, 224, 0.1)',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
  },
  listContent: {
    padding: 16,
  },
  materialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  materialIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(28, 181, 224, 0.1)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
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
    color: '#3A4276',
    marginBottom: 4,
  },
  materialCategory: {
    fontSize: 14,
    color: '#1CB5E0',
    fontWeight: '500',
    marginBottom: 4,
  },
  materialDetails: {
    fontSize: 12,
    color: '#8A94A6',
    marginBottom: 2,
  },
  materialDate: {
    fontSize: 12,
    color: '#8A94A6',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(247, 104, 91, 0.1)',
  },
  tapHint: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  tapHintText: {
    fontSize: 12,
    color: '#8A94A6',
    fontStyle: 'italic',
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
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1CB5E0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#1CB5E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
  },
  modalContent: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
  },
  fileButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  fileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FC',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fileButtonText: {
    color: '#1CB5E0',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 239, 125, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#38EF7D',
  },
  selectedFileName: {
    fontSize: 14,
    color: '#3A4276',
    marginLeft: 8,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#3A4276',
    backgroundColor: '#F8F9FC',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F9FC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipSelected: {
    backgroundColor: '#1CB5E0',
    borderColor: '#1CB5E0',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  uploadButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});

export default TeacherPostMaterialScreen;