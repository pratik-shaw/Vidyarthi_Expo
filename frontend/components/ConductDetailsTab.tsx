import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface ConductEntry {
  _id: string;
  date: string;
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  teacherName: string;
}

interface ConductDetailsTabProps {
  conductEntries: ConductEntry[];
  onAddConduct: () => void;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

const ConductDetailsTab: React.FC<ConductDetailsTabProps> = ({ 
  conductEntries, 
  onAddConduct,
  loading = false,
  error = null,
  onRefresh
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

  // Render conduct item
  const renderConductItem = ({ item }: { item: ConductEntry }) => (
    <View style={styles.conductCard}>
      <View style={styles.conductHeader}>
        <View style={[styles.conductTypeIndicator, { backgroundColor: getConductTypeColor(item.type) }]} />
        <View style={styles.conductInfo}>
          <Text style={styles.conductTitle}>{item.title}</Text>
          <Text style={styles.conductDate}>{formatDate(item.date)}</Text>
        </View>
        <Text style={[styles.conductType, { color: getConductTypeColor(item.type) }]}>
          {item.type.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.conductDescription}>{item.description}</Text>
      <Text style={styles.conductTeacher}>- {item.teacherName}</Text>
    </View>
  );

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
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1CB5E0" />
          <Text style={styles.loadingText}>Loading conduct records...</Text>
        </View>
      ) : conductEntries.length > 0 ? (
        <FlatList
          data={conductEntries}
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
    alignItems: 'center',
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
  },
  conductType: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  conductDescription: {
    fontSize: 14,
    color: '#3A4276',
    lineHeight: 20,
    marginBottom: 8,
  },
  conductTeacher: {
    fontSize: 12,
    color: '#8A94A6',
    fontStyle: 'italic',
    textAlign: 'right',
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