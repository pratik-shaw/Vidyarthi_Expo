import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Intro'>;

// Intro slides data
const slides = [
  {
    id: '1',
    title: 'Welcome to the future of student management',
    description: 'Access your courses and assignments from anywhere, anytime. Our platform is designed to work seamlessly across all your devices.',
    image: require('../assets/images/intro1.jpg'), // Replace with your actual image
    color: '#0d80f2',
  },
  {
    id: '2',
    title: 'Learn Anywhere',
    description: 'Access your courses and assignments from anywhere, anytime. Our platform is designed to work seamlessly across all your devices.',
    image: require('../assets/images/intro2.jpg'), // Replace with your actual image
    color: '#0d80f2',
  },
  {
    id: '3',
    title: 'Track Progress',
    description: 'Monitor your academic journey with detailed analytics and personalized insights to help you achieve your educational goals.',
    image: require('../assets/images/intro3.jpg'), // Replace with your actual image
    color: '#0d80f2',
  },
  {
    id: '4',
    title: 'Get Started',
    description: 'Join our community of learners and educators today and discover a new way to manage your educational experience.',
    image: require('../assets/images/intro4.jpg'), // Replace with your actual image
    color: '#0d80f2',
  },
];

// Brand configuration
const BRAND = {
  name: "Vidyarthi",
  tagline: "Elevate Your Learning Journey",
  primaryColor: '#0d80f2',
  secondaryColor: '#f8fafc',
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  }
};

const IntroScreen: React.FC<Props> = ({ navigation }) => {
  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Animation states
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Run entry animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Handle auto scrolling for carousel
  useEffect(() => {
    let scrollInterval: NodeJS.Timeout;

    if (autoScroll) {
      scrollInterval = setInterval(() => {
        if (currentIndex < slides.length - 1) {
          flatListRef.current?.scrollToIndex({
            index: currentIndex + 1,
            animated: true,
          });
        } else {
          // Stop auto scrolling when reaching the last slide
          setAutoScroll(false);
        }
      }, 3000); // 3 seconds per slide
    }

    return () => {
      if (scrollInterval) clearInterval(scrollInterval);
    };
  }, [currentIndex, autoScroll]);

  // Handle manual scrolling
  useEffect(() => {
    const listener = scrollX.addListener(({ value }) => {
      const index = Math.round(value / width);
      if (index !== currentIndex) {
        setCurrentIndex(index);
      }
    });

    return () => {
      scrollX.removeListener(listener);
    };
  }, [currentIndex, scrollX]);

  // Mark intro as seen and handle navigation to role selection screen
  const handleGetStarted = async () => {
    try {
      // Mark that user has seen the intro
      await AsyncStorage.setItem('hasSeenIntro', 'true');
      console.log('Intro marked as seen');
      
      navigation.replace('RoleSelection');
    } catch (error) {
      console.error('Error saving intro status:', error);
      // Still navigate even if we can't save the status
      navigation.replace('RoleSelection');
    }
  };

  // Handle next slide
  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  // Handle skip intro
  const handleSkip = () => {
    handleGetStarted();
  };

  // Render slide item
  const renderSlideItem = ({ item, index }: { item: typeof slides[0], index: number }) => {
    return (
      <View style={[styles.slide, { backgroundColor: BRAND.secondaryColor }]}>
        <View style={styles.slideImageContainer}>
          <Image 
            source={item.image} 
            style={styles.slideImage} 
            resizeMode="cover" 
          />
        </View>
        <View style={styles.slideTextContainer}>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </View>
      </View>
    );
  };

  // Render indicator dot
  const renderDotIndicator = () => {
    return (
      <View style={styles.dotContainer}>
        {slides.map((_, index) => {
          return (
            <View
              key={index.toString()}
              style={[
                styles.dot,
                {
                  backgroundColor: currentIndex === index ? BRAND.primaryColor : '#cedbe8',
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BRAND.secondaryColor} />
      
      {/* Fixed brand header that stays constant */}
      <Animated.View 
        style={[
          styles.fixedBrandHeader,
          { 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.brandSection}>
          <Image 
            source={require('../assets/images/logo.png')} 
            style={styles.headerLogo} 
            resizeMode="contain" 
          />
          <Text style={styles.headerBrandName}>{BRAND.name}</Text>
        </View>
        
        {/* Skip button */}
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Carousel */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlideItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setAutoScroll(false)} // Stop auto-scroll when user manually scrolls
        style={{ opacity: fadeAnim }}
      />

      {/* Bottom Container */}
      <Animated.View 
        style={[
          styles.bottomContainer,
          { 
            opacity: fadeAnim, 
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* Dot Indicators */}
        {renderDotIndicator()}

        {/* Next Button */}
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: BRAND.primaryColor }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc', // slate-50 equivalent
  },
  fixedBrandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 10,
    zIndex: 10, // Ensure it stays on top
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  headerBrandName: {
    fontSize: 18,
    fontWeight: '700',
    color: 'black',
    letterSpacing: 0.5,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(13, 128, 242, 0.1)',
    position: 'absolute',
    right: 20,
  },
  skipButtonText: {
    color: '#0d80f2',
    fontSize: 14,
    fontWeight: '600',
  },
  slide: {
    width,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start', // Start from top
    paddingTop: 10, // Reduced because we now have a fixed header
  },
  slideImageContainer: {
    width: '92%',
    height: height * 0.45,
    overflow: 'hidden',
    borderRadius: 16, // Rounded corners for image container
    marginBottom: 24,
    // Add subtle shadow for elegance
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  slideTextContainer: {
    width: '90%',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    color: '#0d141c',
    letterSpacing: 0.5, // Elegant spacing
  },
  slideDescription: {
    fontSize: 16,
    color: '#64748b', // Subtle text color for descriptions
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
    letterSpacing: 0.3, // Subtle letter spacing
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 50, // Increased to avoid home indicator on iPhone 15
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  nextButton: {
    backgroundColor: '#0d80f2',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5, // Elegant spacing
  },
});

export default IntroScreen;