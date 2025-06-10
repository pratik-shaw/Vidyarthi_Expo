import React from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  isActive: boolean;
}

interface PersonalDetailsTabProps {
  studentProfile: StudentProfile | null;
}

const PersonalDetailsTab: React.FC<PersonalDetailsTabProps> = ({ studentProfile }) => {
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.detailCard}>
        <View style={styles.cardHeader}>
          <FontAwesome5 name="user-circle" size={24} color="#3A4276" />
          <Text style={styles.cardTitle}>Personal Information</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Full Name:</Text>
          <Text style={styles.detailValue}>{studentProfile?.name}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Student ID:</Text>
          <Text style={styles.detailValue}>{studentProfile?.studentId}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email:</Text>
          <Text style={styles.detailValue}>{studentProfile?.email}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Phone:</Text>
          <Text style={styles.detailValue}>{studentProfile?.phone || 'Not provided'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Class:</Text>
          <Text style={styles.detailValue}>{studentProfile?.className} - {studentProfile?.section}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: studentProfile?.isActive ? 'rgba(56, 239, 125, 0.1)' : 'rgba(247, 104, 91, 0.1)' }]}>
            <Text style={[styles.statusText, { color: studentProfile?.isActive ? '#38EF7D' : '#F7685B' }]}>
              {studentProfile?.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    padding: 16,
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  detailLabel: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default PersonalDetailsTab;