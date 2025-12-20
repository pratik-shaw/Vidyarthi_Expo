import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { ADMIN_API } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminCreateAccountsScreen'>;

type AccountType = 'student' | 'teacher';
type CreationMode = 'manual' | 'bulk';

interface StudentForm {
  name: string;
  class: string;
  section: string;
  email: string;
  phoneNo: string;
  schoolCode: string;
  password: string;
}

interface TeacherForm {
  name: string;
  email: string;
  schoolCode: string;
  uniqueCode: string;
  password: string;
  phoneNo: string;
}

const API_BASE_URL = 'http://10.0.2.2:5000/api';

const AdminCreateAccountsScreen: React.FC<Props> = ({ navigation }) => {
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [creationMode, setCreationMode] = useState<CreationMode>('manual');
  const [isLoading, setIsLoading] = useState(false);

  const [studentForm, setStudentForm] = useState<StudentForm>({
    name: '',
    class: '',
    section: '',
    email: '',
    phoneNo: '',
    schoolCode: '',
    password: '',
  });

  const [teacherForm, setTeacherForm] = useState<TeacherForm>({
    name: '',
    email: '',
    schoolCode: '',
    uniqueCode: '',
    password: '',
    phoneNo: '',
  });

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'Create Accounts',
      headerStyle: { backgroundColor: '#4E54C8' },
      headerTintColor: '#FFFFFF',
    });
  }, [navigation]);

  const getAuthToken = async () => {
    try {
      let token = await AsyncStorage.getItem('authToken');
      if (!token) token = await AsyncStorage.getItem('adminToken');
      if (!token) token = await AsyncStorage.getItem('token');
      if (!token) token = await AsyncStorage.getItem('admin_token');
      
      console.log('Retrieved token:', token ? `Token exists (${token.substring(0, 30)}...)` : 'No token found');
      
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('All AsyncStorage keys:', allKeys);
      
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const createApiClient = async () => {
    const token = await getAuthToken();
    
    if (!token) {
      console.warn('Warning: No auth token found');
    }
    
    console.log('Creating API client with base URL:', ADMIN_API);
    console.log('Auth header:', token ? `Bearer ${token.substring(0, 20)}...` : 'No token');
    
    return axios.create({
      baseURL: ADMIN_API,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });
  };

  const handleManualCreateStudent = async () => {
    const { name, class: cls, section, email, phoneNo, schoolCode, password } = studentForm;
    if (!name || !cls || !section || !email || !phoneNo || !schoolCode || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (phoneNo.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      Alert.alert(
        'Authentication Error',
        'You are not logged in. Please login again.',
        [
          {
            text: 'Go to Login',
            onPress: () => navigation.navigate('AdminLogin')
          }
        ]
      );
      return;
    }

    setIsLoading(true);
    try {
      const apiClient = await createApiClient();
      
      const endpoint = '/api/admin/accounts/create-student';
      const fullUrl = `${ADMIN_API}${endpoint}`;
      
      console.log('Making request to:', fullUrl);
      console.log('Request data:', {
        name: studentForm.name,
        class: studentForm.class,
        section: studentForm.section,
        email: studentForm.email,
        phoneNo: studentForm.phoneNo,
        schoolCode: studentForm.schoolCode,
      });
      
      const response = await apiClient.post(endpoint, {
        name: studentForm.name,
        class: studentForm.class,
        section: studentForm.section,
        email: studentForm.email,
        phoneNo: studentForm.phoneNo,
        schoolCode: studentForm.schoolCode,
        password: studentForm.password,
      });

      setIsLoading(false);
      
      if (response.data && response.data.message) {
        Alert.alert(
          'Success', 
          response.data.message,
          [
            {
              text: 'OK',
              onPress: () => resetStudentForm()
            }
          ]
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error('Error creating student:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Request URL:', error.config?.url);
      
      let errorMessage = 'Failed to create student account';
      
      if (error.response?.status === 401) {
        Alert.alert(
          'Authentication Error',
          'Your session has expired. Please login again.',
          [
            {
              text: 'Go to Login',
              onPress: () => navigation.navigate('AdminLogin')
            }
          ]
        );
        return;
      }
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 404) {
        errorMessage = 'API endpoint not found. Please check your server configuration.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleManualCreateTeacher = async () => {
    const { name, email, schoolCode, uniqueCode, password, phoneNo } = teacherForm;
    if (!name || !email || !schoolCode || !uniqueCode || !password || !phoneNo) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (phoneNo.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      Alert.alert(
        'Authentication Error',
        'You are not logged in. Please login again.',
        [
          {
            text: 'Go to Login',
            onPress: () => navigation.navigate('AdminLogin')
          }
        ]
      );
      return;
    }

    setIsLoading(true);
    try {
      const apiClient = await createApiClient();
      
      const endpoint = '/api/admin/accounts/create-teacher';
      const fullUrl = `${ADMIN_API}${endpoint}`;
      
      console.log('Making request to:', fullUrl);
      console.log('Request data:', {
        name: teacherForm.name,
        email: teacherForm.email,
        schoolCode: teacherForm.schoolCode,
        uniqueCode: teacherForm.uniqueCode,
        phoneNo: teacherForm.phoneNo,
      });
      
      const response = await apiClient.post(endpoint, {
        name: teacherForm.name,
        email: teacherForm.email,
        schoolCode: teacherForm.schoolCode,
        uniqueCode: teacherForm.uniqueCode,
        password: teacherForm.password,
        phoneNo: teacherForm.phoneNo,
      });

      setIsLoading(false);
      
      if (response.data && response.data.message) {
        Alert.alert(
          'Success', 
          response.data.message,
          [
            {
              text: 'OK',
              onPress: () => resetTeacherForm()
            }
          ]
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error('Error creating teacher:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let errorMessage = 'Failed to create teacher account';
      
      if (error.response?.status === 401) {
        Alert.alert(
          'Authentication Error',
          'Your session has expired. Please login again.',
          [
            {
              text: 'Go to Login',
              onPress: () => navigation.navigate('AdminLogin')
            }
          ]
        );
        return;
      }
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 404) {
        errorMessage = 'API endpoint not found. Please check your server configuration.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleBulkUploadStudents = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setIsLoading(true);
      
      const response = await fetch(result.assets[0].uri);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        Alert.alert('Error', 'Excel sheet is empty');
        setIsLoading(false);
        return;
      }

      const requiredFields = ['name', 'class', 'section', 'email', 'phoneNo', 'schoolCode', 'password'];
      const invalidRows: number[] = [];
      
      jsonData.forEach((row, index) => {
        const missingFields = requiredFields.filter(field => !row[field]);
        if (missingFields.length > 0) {
          invalidRows.push(index + 2);
        }
      });

      if (invalidRows.length > 0) {
        Alert.alert(
          'Validation Error', 
          `Missing required fields in rows: ${invalidRows.join(', ')}. Please check your Excel file.`
        );
        setIsLoading(false);
        return;
      }

      const apiClient = await createApiClient();
      
      const bulkResponse = await apiClient.post('/api/admin/accounts/bulk-create-students', {
        students: jsonData
      });

      setIsLoading(false);

      if (bulkResponse.data && bulkResponse.data.results) {
        const { successCount, failCount, failed } = bulkResponse.data.results;
        
        let message = `Successfully created ${successCount} student account(s).`;
        if (failCount > 0) {
          message += `\n\nFailed to create ${failCount} account(s).`;
          
          if (failed.length > 0) {
            const failedRows = failed.slice(0, 3).map((f: any) => 
              `Row ${f.row}: ${f.error}`
            ).join('\n');
            
            message += `\n\nFirst few errors:\n${failedRows}`;
            
            if (failed.length > 3) {
              message += `\n... and ${failed.length - 3} more`;
            }
          }
        }
        
        Alert.alert(
          successCount > 0 ? 'Upload Complete' : 'Upload Failed',
          message
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error('Error in bulk upload:', error);
      
      let errorMessage = 'Failed to process Excel file';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleBulkUploadTeachers = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setIsLoading(true);
      
      const response = await fetch(result.assets[0].uri);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        Alert.alert('Error', 'Excel sheet is empty');
        setIsLoading(false);
        return;
      }

      const requiredFields = ['name', 'email', 'schoolCode', 'uniqueCode', 'password', 'phoneNo'];
      const invalidRows: number[] = [];
      
      jsonData.forEach((row, index) => {
        const missingFields = requiredFields.filter(field => !row[field]);
        if (missingFields.length > 0) {
          invalidRows.push(index + 2);
        }
      });

      if (invalidRows.length > 0) {
        Alert.alert(
          'Validation Error', 
          `Missing required fields in rows: ${invalidRows.join(', ')}. Please check your Excel file.`
        );
        setIsLoading(false);
        return;
      }

      const apiClient = await createApiClient();
      
      const bulkResponse = await apiClient.post('/api/admin/accounts/bulk-create-teachers', {
        teachers: jsonData
      });

      setIsLoading(false);

      if (bulkResponse.data && bulkResponse.data.results) {
        const { successCount, failCount, failed } = bulkResponse.data.results;
        
        let message = `Successfully created ${successCount} teacher account(s).`;
        if (failCount > 0) {
          message += `\n\nFailed to create ${failCount} account(s).`;
          
          if (failed.length > 0) {
            const failedRows = failed.slice(0, 3).map((f: any) => 
              `Row ${f.row}: ${f.error}`
            ).join('\n');
            
            message += `\n\nFirst few errors:\n${failedRows}`;
            
            if (failed.length > 3) {
              message += `\n... and ${failed.length - 3} more`;
            }
          }
        }
        
        Alert.alert(
          successCount > 0 ? 'Upload Complete' : 'Upload Failed',
          message
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error('Error in bulk upload:', error);
      
      let errorMessage = 'Failed to process Excel file';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const resetStudentForm = () => {
    setStudentForm({
      name: '',
      class: '',
      section: '',
      email: '',
      phoneNo: '',
      schoolCode: '',
      password: '',
    });
  };

  const resetTeacherForm = () => {
    setTeacherForm({
      name: '',
      email: '',
      schoolCode: '',
      uniqueCode: '',
      password: '',
      phoneNo: '',
    });
  };

  const downloadStudentTemplate = () => {
    Alert.alert(
      'Student Excel Template',
      'Required columns in order:\n\n' +
      '1. name - Full name of student\n' +
      '2. class - Class name (e.g., "10")\n' +
      '3. section - Section (e.g., "A")\n' +
      '4. email - Email address\n' +
      '5. phoneNo - Phone number\n' +
      '6. schoolCode - School code\n' +
      '7. password - Account password\n\n' +
      'Note: Column names must match exactly (case-sensitive)'
    );
  };

  const downloadTeacherTemplate = () => {
    Alert.alert(
      'Teacher Excel Template',
      'Required columns in order:\n\n' +
      '1. name - Full name of teacher\n' +
      '2. email - Email address\n' +
      '3. schoolCode - School code\n' +
      '4. uniqueCode - Unique teacher code\n' +
      '5. password - Account password\n' +
      '6. phoneNo - Phone number\n\n' +
      'Note: Column names must match exactly (case-sensitive)'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#4E54C8" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* Account Type Selection */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account Type</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, accountType === 'student' && styles.typeButtonActive]}
              onPress={() => setAccountType('student')}
            >
              <FontAwesome5 
                name="user-graduate" 
                size={20} 
                color={accountType === 'student' ? '#FFFFFF' : '#4E54C8'} 
              />
              <Text style={[styles.typeButtonText, accountType === 'student' && styles.typeButtonTextActive]}>
                Student
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.typeButton, accountType === 'teacher' && styles.typeButtonActive]}
              onPress={() => setAccountType('teacher')}
            >
              <FontAwesome5 
                name="chalkboard-teacher" 
                size={20} 
                color={accountType === 'teacher' ? '#FFFFFF' : '#4E54C8'} 
              />
              <Text style={[styles.typeButtonText, accountType === 'teacher' && styles.typeButtonTextActive]}>
                Teacher
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Creation Mode Selection */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Creation Mode</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, creationMode === 'manual' && styles.typeButtonActive]}
              onPress={() => setCreationMode('manual')}
            >
              <MaterialIcons 
                name="person-add" 
                size={22} 
                color={creationMode === 'manual' ? '#FFFFFF' : '#4E54C8'} 
              />
              <Text style={[styles.typeButtonText, creationMode === 'manual' && styles.typeButtonTextActive]}>
                Manual
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.typeButton, creationMode === 'bulk' && styles.typeButtonActive]}
              onPress={() => setCreationMode('bulk')}
            >
              <MaterialIcons 
                name="upload-file" 
                size={22} 
                color={creationMode === 'bulk' ? '#FFFFFF' : '#4E54C8'} 
              />
              <Text style={[styles.typeButtonText, creationMode === 'bulk' && styles.typeButtonTextActive]}>
                Bulk Upload
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Manual Student Form */}
        {creationMode === 'manual' && accountType === 'student' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Student Details</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={studentForm.name}
              onChangeText={(text) => setStudentForm({ ...studentForm, name: text })}
            />
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Class"
                value={studentForm.class}
                onChangeText={(text) => setStudentForm({ ...studentForm, class: text })}
              />
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Section"
                value={studentForm.section}
                onChangeText={(text) => setStudentForm({ ...studentForm, section: text })}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={studentForm.email}
              onChangeText={(text) => setStudentForm({ ...studentForm, email: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={studentForm.phoneNo}
              onChangeText={(text) => setStudentForm({ ...studentForm, phoneNo: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="School Code"
              value={studentForm.schoolCode}
              onChangeText={(text) => setStudentForm({ ...studentForm, schoolCode: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={studentForm.password}
              onChangeText={(text) => setStudentForm({ ...studentForm, password: text })}
            />
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleManualCreateStudent}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Create Student Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Manual Teacher Form */}
        {creationMode === 'manual' && accountType === 'teacher' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Teacher Details</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={teacherForm.name}
              onChangeText={(text) => setTeacherForm({ ...teacherForm, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={teacherForm.email}
              onChangeText={(text) => setTeacherForm({ ...teacherForm, email: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={teacherForm.phoneNo}
              onChangeText={(text) => setTeacherForm({ ...teacherForm, phoneNo: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="School Code"
              value={teacherForm.schoolCode}
              onChangeText={(text) => setTeacherForm({ ...teacherForm, schoolCode: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Unique Teacher Code"
              value={teacherForm.uniqueCode}
              onChangeText={(text) => setTeacherForm({ ...teacherForm, uniqueCode: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={teacherForm.password}
              onChangeText={(text) => setTeacherForm({ ...teacherForm, password: text })}
            />
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleManualCreateTeacher}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Create Teacher Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Bulk Upload Students */}
        {creationMode === 'bulk' && accountType === 'student' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Bulk Upload Students</Text>
            
            <TouchableOpacity 
              style={styles.templateButton}
              onPress={downloadStudentTemplate}
            >
              <Feather name="download" size={18} color="#4E54C8" />
              <Text style={styles.templateButtonText}>View Template Format</Text>
            </TouchableOpacity>

            <View style={styles.uploadInfo}>
              <MaterialIcons name="info" size={20} color="#8A94A6" />
              <Text style={styles.uploadInfoText}>
                Upload an Excel file (.xlsx, .xls) with student details. Ensure all required columns are present.
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={handleBulkUploadStudents}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="cloud-upload" size={24} color="#FFFFFF" />
                  <Text style={styles.uploadButtonText}>Select Excel File</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Bulk Upload Teachers */}
        {creationMode === 'bulk' && accountType === 'teacher' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Bulk Upload Teachers</Text>
            
            <TouchableOpacity 
              style={styles.templateButton}
              onPress={downloadTeacherTemplate}
            >
              <Feather name="download" size={18} color="#4E54C8" />
              <Text style={styles.templateButtonText}>View Template Format</Text>
            </TouchableOpacity>

            <View style={styles.uploadInfo}>
              <MaterialIcons name="info" size={20} color="#8A94A6" />
              <Text style={styles.uploadInfoText}>
                Upload an Excel file (.xlsx, .xls) with teacher details. Ensure all required columns are present.
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={handleBulkUploadTeachers}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="cloud-upload" size={24} color="#FFFFFF" />
                  <Text style={styles.uploadButtonText}>Select Excel File</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  scrollContainer: {
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
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
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4E54C8',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4E54C8',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F8F9FC',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#3A4276',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8ECEF',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#4E54C8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    marginTop: 8,
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4E54C8',
    backgroundColor: '#F8F9FC',
    marginBottom: 16,
    gap: 8,
  },
  templateButtonText: {
    color: '#4E54C8',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  uploadInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#8A94A6',
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: '#4E54C8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    gap: 10,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminCreateAccountsScreen ;