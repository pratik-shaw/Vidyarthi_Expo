import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface StudentProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  studentId: string;
  uniqueId: string;
  className: string;
  section: string;
  schoolId: string;
  schoolName?: string;
  schoolCode?: string;
  classId: string; // Added this missing property
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface PersonalDetailsTabProps {
  studentProfile: StudentProfile | null;
  loading?: boolean;
}

const PersonalDetailsTab: React.FC<PersonalDetailsTabProps> = ({ 
  studentProfile, 
  loading = false 
}) => {
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1CB5E0" />
        <Text style={styles.loadingText}>Loading student profile...</Text>
      </View>
    );
  }

  if (!studentProfile) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="user-times" size={48} color="#8A94A6" />
        <Text style={styles.errorText}>Student profile not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.detailCard}>
        <View style={styles.cardHeader}>
          <FontAwesome5 name="user-circle" size={24} color="#3A4276" />
          <Text style={styles.cardTitle}>Personal Information</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Full Name:</Text>
          <Text style={styles.detailValue}>{studentProfile.name || 'Not provided'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Student ID:</Text>
          <Text style={styles.detailValue}>{studentProfile.studentId || 'Not assigned'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Unique ID:</Text>
          <Text style={styles.detailValue}>{studentProfile.uniqueId || 'Not assigned'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email:</Text>
          <Text style={styles.detailValue}>{studentProfile.email || 'Not provided'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Phone:</Text>
          <Text style={styles.detailValue}>{studentProfile.phone || 'Not provided'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>School:</Text>
          <Text style={styles.detailValue}>
            {studentProfile.schoolName || 'Not available'}
            {studentProfile.schoolCode && ` (${studentProfile.schoolCode})`}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Class:</Text>
          <Text style={styles.detailValue}>
            {studentProfile.className || 'Not assigned'}
            {studentProfile.section && ` - Section ${studentProfile.section}`}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: studentProfile.isActive ? 'rgba(56, 239, 125, 0.1)' : 'rgba(247, 104, 91, 0.1)' }
          ]}>
            <Text style={[
              styles.statusText, 
              { color: studentProfile.isActive ? '#38EF7D' : '#F7685B' }
            ]}>
              {studentProfile.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Joined Date:</Text>
          <Text style={styles.detailValue}>{formatDate(studentProfile.createdAt)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Last Updated:</Text>
          <Text style={styles.detailValue}>{formatDate(studentProfile.updatedAt)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginLeft: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
    minHeight: 44,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});

export default PersonalDetailsTab;