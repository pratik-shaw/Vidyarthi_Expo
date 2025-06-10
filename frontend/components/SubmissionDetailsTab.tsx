import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

// Interface definitions
interface Submission {
  _id: string;
  title: string;
  subject: string;
  submittedDate: string;
  dueDate: string;
  status: 'submitted' | 'late' | 'pending';
  grade?: string;
  feedback?: string;
}

interface Props {
  submissions: Submission[];
  loading?: boolean;
}

const SubmissionDetailsTab: React.FC<Props> = ({ submissions, loading = false }) => {
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return '#38EF7D';
      case 'late': return '#FFA726';
      case 'pending': return '#F7685B';
      default: return '#8A94A6';
    }
  };

  // Render submission card
  const renderSubmissionCard = ({ item }: { item: Submission }) => (
    <View style={styles.submissionCard}>
      <View style={styles.submissionHeader}>
        <Text style={styles.submissionTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <Text style={styles.submissionSubject}>{item.subject}</Text>
      
      <View style={styles.submissionDates}>
        <Text style={styles.submissionDate}>
          Submitted: {new Date(item.submittedDate).toLocaleDateString()}
        </Text>
        <Text style={styles.submissionDate}>
          Due: {new Date(item.dueDate).toLocaleDateString()}
        </Text>
      </View>
      
      {item.grade && (
        <View style={styles.gradeContainer}>
          <Text style={styles.gradeLabel}>Grade: </Text>
          <Text style={styles.gradeValue}>{item.grade}</Text>
        </View>
      )}
      
      {item.feedback && (
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackLabel}>Feedback:</Text>
          <Text style={styles.feedbackText}>{item.feedback}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Student Submissions</Text>
      
      {submissions.length > 0 ? (
        <FlatList
          data={submissions}
          renderItem={renderSubmissionCard}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyStateContainer}>
          <FontAwesome5 name="file-alt" size={36} color="#B0B7C3" />
          <Text style={styles.emptyStateText}>No submissions yet</Text>
          <Text style={styles.emptyStateSubtext}>Student submissions will appear here</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 16,
  },
  submissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  submissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    flex: 1,
    marginRight: 12,
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
  submissionSubject: {
    fontSize: 14,
    color: '#8A94A6',
    marginBottom: 12,
    fontWeight: '500',
  },
  submissionDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  submissionDate: {
    fontSize: 12,
    color: '#8A94A6',
  },
  gradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeLabel: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '500',
  },
  gradeValue: {
    fontSize: 14,
    color: '#1CB5E0',
    fontWeight: '600',
  },
  feedbackContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
  },
  feedbackLabel: {
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '600',
    marginBottom: 4,
  },
  feedbackText: {
    fontSize: 14,
    color: '#3A4276',
    lineHeight: 20,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SubmissionDetailsTab;