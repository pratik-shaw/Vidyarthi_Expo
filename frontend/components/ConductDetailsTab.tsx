import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface ConductEntry {
  _id: string;
  studentId: string;
  teacherId: string;
  classId: string;
  schoolId: string;
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  date: string;
  isActive: boolean;
  severity: 'low' | 'medium' | 'high';
  actionTaken?: string;
  parentNotified: boolean;
  followUpRequired: boolean;
  followUpDate?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  teacherName?: string;
  studentName?: string;
}

interface ConductSummary {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  lastEntry: string | null;
}

interface ConductData {
  conducts: ConductEntry[];
  summary: ConductSummary;
  totalRecords: number;
}

interface ConductDetailsTabProps {
  conductData: ConductData | null;
  loading: boolean;
  error: string | null;
  onAddConduct: () => void;
  onRefresh: () => void;
  onDeleteConduct: (conductId: string) => Promise<void>;
}

const ConductDetailsTab: React.FC<ConductDetailsTabProps> = ({ 
  conductData,
  loading,
  error,
  onAddConduct,
  onRefresh,
  onDeleteConduct
}) => {
  // Get conduct type color
  const getConductTypeColor = (type: string) => {
    switch (type) {
      case 'positive': return '#38EF7D';
      case 'negative': return '#F7685B';
      case 'neutral': return '#1CB5E0';
      default: return '#8A94A6';
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return '#38EF7D';
      case 'medium': return '#FFB800';
      case 'high': return '#F7685B';
      default: return '#8A94A6';
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Handle delete conduct
  const handleDeleteConduct = (conductId: string, title: string) => {
    Alert.alert(
      "Delete Conduct Entry",
      `Are you sure you want to delete "${title}"?`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDeleteConduct(conductId)
        }
      ]
    );
  };

  // Render conduct item
  const renderConductItem = ({ item }: { item: ConductEntry }) => (
    <View style={styles.conductCard}>
      <View style={styles.conductHeader}>
        <View style={[styles.conductTypeIndicator, { backgroundColor: getConductTypeColor(item.type) }]} />
        <View style={styles.conductInfo}>
          <Text style={styles.conductTitle}>{item.title}</Text>
          <Text style={styles.conductDate}>{formatDate(item.date)}</Text>
          <View style={styles.conductBadges}>
            <Text style={[styles.conductType, { color: getConductTypeColor(item.type) }]}>
              {item.type.toUpperCase()}
            </Text>
            <Text style={[styles.severityBadge, { color: getSeverityColor(item.severity) }]}>
              {item.severity.toUpperCase()}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => handleDeleteConduct(item._id, item.title)}
        >
          <FontAwesome5 name="trash" size={14} color="#F7685B" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.conductDescription}>{item.description}</Text>
      
      {item.actionTaken && (
        <View style={styles.actionTakenContainer}>
          <Text style={styles.actionTakenLabel}>Action Taken:</Text>
          <Text style={styles.actionTakenText}>{item.actionTaken}</Text>
        </View>
      )}
      
      <View style={styles.conductFooter}>
        <View style={styles.conductFlags}>
          {item.parentNotified && (
            <View style={styles.flag}>
              <FontAwesome5 name="bell" size={10} color="#1CB5E0" />
              <Text style={styles.flagText}>Parent Notified</Text>
            </View>
          )}
          {item.followUpRequired && (
            <View style={styles.flag}>
              <FontAwesome5 name="clock" size={10} color="#FFB800" />
              <Text style={styles.flagText}>Follow-up Required</Text>
            </View>
          )}
        </View>
        <Text style={styles.conductTeacher}>- {item.teacherName || 'Teacher'}</Text>
      </View>
    </View>
  );

  // Render summary cards
  const renderSummaryCards = () => {
    if (!conductData?.summary) return null;

    const { summary } = conductData;
    
    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <FontAwesome5 name="thumbs-up" size={20} color="#38EF7D" />
          <Text style={styles.summaryNumber}>{summary.positive}</Text>
          <Text style={styles.summaryLabel}>Positive</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <FontAwesome5 name="minus-circle" size={20} color="#1CB5E0" />
          <Text style={styles.summaryNumber}>{summary.neutral}</Text>
          <Text style={styles.summaryLabel}>Neutral</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <FontAwesome5 name="thumbs-down" size={20} color="#F7685B" />
          <Text style={styles.summaryNumber}>{summary.negative}</Text>
          <Text style={styles.summaryLabel}>Negative</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <FontAwesome5 name="clipboard-list" size={20} color="#3A4276" />
          <Text style={styles.summaryNumber}>{summary.total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>
    );
  };

  // Render error state
  if (error) {
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Conduct Records</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={onAddConduct}
          >
            <FontAwesome5 name="plus" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.errorContainer}>
          <FontAwesome5 name="exclamation-triangle" size={36} color="#F7685B" />
          <Text style={styles.errorText}>{error}</Text>
          {onRefresh && (
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Conduct Records</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={onAddConduct}
        >
          <FontAwesome5 name="plus" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {renderSummaryCards()}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1CB5E0" />
          <Text style={styles.loadingText}>Loading conduct records...</Text>
        </View>
      ) : conductData && conductData.conducts.length > 0 ? (
        <FlatList
          data={conductData.conducts}
          renderItem={renderConductItem}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyStateContainer}>
          <FontAwesome5 name="clipboard-list" size={36} color="#B0B7C3" />
          <Text style={styles.emptyStateText}>No conduct records yet</Text>
          <Text style={styles.emptyStateSubtext}>Add conduct records to track student behavior</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3A4276',
  },
  addButton: {
    backgroundColor: '#1CB5E0',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3A4276',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 2,
  },
  conductCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  conductHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  conductTypeIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  conductInfo: {
    flex: 1,
  },
  conductTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  conductDate: {
    fontSize: 12,
    color: '#8A94A6',
    marginBottom: 6,
  },
  conductBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conductType: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginRight: 8,
  },
  severityBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  deleteButton: {
    padding: 8,
  },
  conductDescription: {
    fontSize: 14,
    color: '#3A4276',
    lineHeight: 20,
    marginBottom: 8,
  },
  actionTakenContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  actionTakenLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A94A6',
    marginBottom: 4,
  },
  actionTakenText: {
    fontSize: 14,
    color: '#3A4276',
    lineHeight: 18,
  },
  conductFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  conductFlags: {
    flexDirection: 'row',
    flex: 1,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 181, 224, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  flagText: {
    fontSize: 10,
    color: '#1CB5E0',
    marginLeft: 4,
  },
  conductTeacher: {
    fontSize: 12,
    color: '#8A94A6',
    fontStyle: 'italic',
  },
  emptyStateContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#8A94A6',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#B0B7C3',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#8A94A6',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#F7685B',
    marginTop: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1CB5E0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default ConductDetailsTab;