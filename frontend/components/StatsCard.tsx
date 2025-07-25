import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface StatsCardProps {
  title: string;
  value: string;
  icon: string;
  color: string;
  index: number;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, index }) => {
  // Use useRef to prevent re-creation of Animated.Value on re-renders
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Reset animation values
    opacity.setValue(0);
    translateY.setValue(20);

    // Start animation with staggered delay based on index
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        delay: 100 + (index * 100),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay: 100 + (index * 100),
        useNativeDriver: true,
      }),
    ]).start();
  }, [title, value, icon, color, index]); // Add dependencies to re-animate when props change

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }]
        }
      ]}
    >
      <View style={styles.card}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <FontAwesome5 name={icon} size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 4, // Add horizontal margin for better spacing
    minWidth: 0, // Prevent flex shrinking issues
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16, // Increased padding for better touch target
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 100, // Ensure consistent height
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A4276',
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8A94A6',
    textAlign: 'center',
  },
});

export default StatsCard;