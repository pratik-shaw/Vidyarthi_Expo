// components/ProfileBanner.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface StudentProps {
  name: string;
  id: string;
  class: string;
  phone: string;
  email: string;
  imageUrl: string;
}

interface ProfileBannerProps {
  student: StudentProps;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  onPress: () => void;
}

const ProfileBanner: React.FC<ProfileBannerProps> = ({ 
  student, 
  fadeAnim, 
  slideAnim,
  onPress 
}) => {
  return (
    <Animated.View
      style={[
        styles.profileCardContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.profileCard}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <View style={styles.profileInfo}>
          <View style={styles.profileHeader}>
            <Text style={styles.profileName}>{student.name}</Text>
            <View style={styles.idBadge}>
              <Text style={styles.idText}>{student.id}</Text>
            </View>
          </View>
          
          <View style={styles.profileDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Class:</Text>
              <Text style={styles.detailValue}>{student.class}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone:</Text>
              <Text style={styles.detailValue}>{student.phone}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>{student.email}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.profileRightSection}>
          <View style={styles.profileImageContainer}>
            <Image
              style={styles.profileImage}
              source={{ uri: student.imageUrl }}
            />
          </View>
          <View style={styles.editProfileButton}>
            <Feather name="edit-2" size={14} color="#4E54C8" />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  profileCardContainer: {
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  profileCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 16,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    marginRight: 10,
  },
  idBadge: {
    backgroundColor: '#F0F1F6',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  idText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3A4276',
  },
  profileDetails: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A94A6',
    width: 50,
  },
  detailValue: {
    fontSize: 14,
    color: '#3A4276',
    flex: 1,
  },
  profileRightSection: {
    marginLeft: 15,
    alignItems: 'center',
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#F0F1F6',
  },
  editProfileButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  }
});

export default ProfileBanner;