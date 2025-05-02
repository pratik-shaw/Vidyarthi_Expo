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
  const [showSplash, setShowSplash] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const splashScale = useRef(new Animated.Value(1)).current;

  // Handle splash screen animation
  useEffect(() => {
    // Start with splash screen
    const splashTimeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(splashScale, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowSplash(false);
      });
    }, 2000); // 2 seconds for splash screen

    return () => clearTimeout(splashTimeout);
  }, []);

  // Handle auto scrolling for carousel
  useEffect(() => {
    let scrollInterval: NodeJS.Timeout;

    if (!showSplash && autoScroll) {
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
  }, [currentIndex, showSplash, autoScroll]);

  // Handle manual scrolling
  useEffect(() => {
    scrollX.addListener(({ value }) => {
      const index = Math.round(value / width);
      if (index !== currentIndex) {
        setCurrentIndex(index);
      }
    });

    return () => {
      scrollX.removeAllListeners();
    };
  }, [currentIndex]);

  // Handle navigation to login screen
  const handleGetStarted = () => {
    navigation.replace('Login');
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

  // Render splash screen
  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar hidden />
        <Animated.View
          style={[
            styles.splashContent,
            {
              opacity: splashOpacity,
              transform: [{ scale: splashScale }],
            },
          ]}
        >
          <Image
            source={require('../assets/images/logo.png')} // Replace with your actual logo
            style={styles.splashLogo}
            resizeMode="contain"
          />
          <Text style={styles.splashText}>{BRAND.name}</Text>
          <Text style={styles.splashTagline}>{BRAND.tagline}</Text>
        </Animated.View>
      </View>
    );
  }

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
      <View style={styles.fixedBrandHeader}>
        <Image 
          source={require('../assets/images/logo.png')} 
          style={styles.headerLogo} 
          resizeMode="contain" 
        />
        <Text style={styles.headerBrandName}>{BRAND.name}</Text>
      </View>

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
      />

      {/* Bottom Container */}
      <View style={styles.bottomContainer}>
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
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc', // slate-50 equivalent
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  splashContent: {
    alignItems: 'center',
  },
  splashLogo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  splashText: {
    fontSize: 32,
    fontWeight: '700',
    color: 'black', // Primary color
    letterSpacing: 1, // Elegant spacing
  },
  splashTagline: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b', // Subtle secondary color
    marginTop: 8,
    letterSpacing: 0.5,
  },
  fixedBrandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 10,
    zIndex: 10, // Ensure it stays on top
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