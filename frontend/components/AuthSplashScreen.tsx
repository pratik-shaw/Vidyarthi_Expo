import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// Brand configuration
const BRAND = {
  name: "Vidyarthi",
  tagline: "Elevate Your Learning Journey",
  primaryColor: '#0d80f2',
  secondaryColor: '#f8fafc',
};

interface AuthSplashScreenProps {
  onAnimationComplete: () => void;
}

const AuthSplashScreen: React.FC<AuthSplashScreenProps> = ({ onAnimationComplete }) => {
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.8)).current;
  const logoRotation = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start entrance animation sequence
    Animated.sequence([
      // First, fade in and scale the logo
      Animated.parallel([
        Animated.timing(splashOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(splashScale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // Then rotate the logo
      Animated.timing(logoRotation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      // Finally fade in the tagline
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Hold for a moment, then start exit animation
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(splashOpacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(splashScale, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(taglineOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onAnimationComplete();
        });
      }, 1200); // Hold for 1.2 seconds after all animations complete
    });
  }, [splashOpacity, splashScale, logoRotation, taglineOpacity, onAnimationComplete]);

  const rotateInterpolate = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.splashContainer}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor={BRAND.secondaryColor} 
        translucent={false}
      />
      
      <Animated.View
        style={[
          styles.splashContent,
          {
            opacity: splashOpacity,
            transform: [{ scale: splashScale }],
          },
        ]}
      >
        {/* Logo Container */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ rotate: rotateInterpolate }],
            }
          ]}
        >
          <Image
            source={require('../assets/images/logo.png')} // Make sure this path is correct
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand Name */}
        <Animated.Text 
          style={[
            styles.splashText,
            { opacity: splashOpacity }
          ]}
        >
          {BRAND.name}
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text 
          style={[
            styles.splashTagline,
            { opacity: taglineOpacity }
          ]}
        >
          {BRAND.tagline}
        </Animated.Text>

        {/* Loading indicator */}
        <Animated.View 
          style={[
            styles.loadingContainer,
            { opacity: taglineOpacity }
          ]}
        >
          <View style={styles.loadingDots}>
            <Animated.View style={[styles.dot, styles.dot1]} />
            <Animated.View style={[styles.dot, styles.dot2]} />
            <Animated.View style={[styles.dot, styles.dot3]} />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc', // Light background like IntroScreen
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 16,
  },
  splashLogo: {
    width: 120,
    height: 120,
  },
  splashText: {
    fontSize: 32,
    fontWeight: '700',
    color: 'black', // Black text like IntroScreen
    letterSpacing: 1, // Elegant spacing
    marginBottom: 8,
    textAlign: 'center',
  },
  splashTagline: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b', // Subtle secondary color like IntroScreen
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  loadingContainer: {
    marginTop: 20,
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cedbe8', // Light dots
    marginHorizontal: 4,
  },
  dot1: {
    backgroundColor: BRAND.primaryColor, // Primary color for active dot
  },
  dot2: {
    backgroundColor: '#cedbe8',
  },
  dot3: {
    backgroundColor: '#cedbe8',
  },
});

export default AuthSplashScreen;