// components/FeatureCard.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface FeatureCardProps {
  title: string;
  icon: string;
  color: string;
  index: number;
  onPress: () => void;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ 
  title, 
  icon, 
  color, 
  index, 
  onPress 
}) => {
  const cardFade = new Animated.Value(0);
  const cardSlide = new Animated.Value(40);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardFade, {
        toValue: 1,
        duration: 500,
        delay: 300 + (index * 100),
        useNativeDriver: true,
      }),
      Animated.timing(cardSlide, {
        toValue: 0,
        duration: 500,
        delay: 300 + (index * 100),
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.featureCardContainer,
        {
          opacity: cardFade,
          transform: [{ translateY: cardSlide }],
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.featureCard, { borderLeftColor: color }]}
        onPress={onPress}
      >
        <View style={[styles.featureIconContainer, { backgroundColor: `${color}10` }]}>
          <FontAwesome5 name={icon} size={18} color={color} />
        </View>
        
        <View style={styles.featureTextContainer}>
          <Text style={styles.featureTitle}>{title}</Text>
        </View>
        
        <View style={styles.featureArrowContainer}>
          <View style={[styles.featureArrow, { backgroundColor: color }]}>
            <Text style={styles.featureArrowText}>→</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  featureCardContainer: {
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 14,
    borderLeftWidth: 4,
  },
  featureIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
  },
  featureArrowContainer: {
    marginLeft: 10,
  },
  featureArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureArrowText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default FeatureCard;