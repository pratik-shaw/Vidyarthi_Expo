import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface ClassSelectionModalProps {
  visible: boolean;
  classes: ClassOption[];
  onSelect: (classId: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

const ClassSelectionModal: React.FC<ClassSelectionModalProps> = ({
  visible,
  classes,
  onSelect,
  onClose,
  isLoading
}) => {
  const renderClassItem = ({ item }: { item: ClassOption }) => (
    <TouchableOpacity
      style={styles.classItem}
      onPress={() => onSelect(item._id)}
      disabled={isLoading}
    >
      <View style={styles.classIconContainer}>
        <FontAwesome5 name="school" size={18} color="#4E54C8" />
      </View>
      <View style={styles.classInfoContainer}>
        <Text style={styles.className}>Class {item.name}</Text>
        <Text style={styles.classSection}>Section {item.section}</Text>
      </View>
      <FontAwesome5 name="chevron-right" size={14} color="#8A94A6" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Your Class</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={isLoading}>
              <Ionicons name="close" size={24} color="#3A4276" />
            </TouchableOpacity>
          </View>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4E54C8" />
              <Text style={styles.loadingText}>Loading available classes...</Text>
            </View>
          ) : classes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="exclamation-circle" size={48} color="#8A94A6" />
              <Text style={styles.emptyText}>No classes found</Text>
              <Text style={styles.emptySubtext}>Please contact your school administrator</Text>
            </View>
          ) : (
            <>
              <Text style={styles.modalSubtitle}>
                Please select your class from the list below
              </Text>
              
              <FlatList
                data={classes}
                renderItem={renderClassItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.classList}
                showsVerticalScrollIndicator={false}
              />
              
              <TouchableOpacity
                style={[styles.cancelButton, isLoading && styles.disabledButton]}
                onPress={onClose}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel Selection</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3A4276',
  },
  closeButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#8A94A6',
    marginBottom: 24,
  },
  classList: {
    paddingBottom: 16,
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  classIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  classInfoContainer: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  classSection: {
    fontSize: 14,
    color: '#8A94A6',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 16,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#8A94A6',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8A94A6',
    marginTop: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8A94A6',
    marginTop: 8,
    textAlign: 'center',
  }
});

export default ClassSelectionModal;