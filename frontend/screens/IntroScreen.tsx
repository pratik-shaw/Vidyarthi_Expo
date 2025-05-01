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
    title: 'Welcome to Vidyarthi',
    description: 'Your complete education management solution',
    image: require('../assets/images/intro1.jpg'), // Replace with your actual image
    color: '#4E54C8',
  },
  {
    id: '2',
    title: 'Learn Anywhere',
    description: 'Access your courses and assignments from anywhere, anytime',
    image: require('../assets/images/intro2.jpg'), // Replace with your actual image
    color: '#1CB5E0',
  },
  {
    id: '3',
    title: 'Track Progress',
    description: 'Monitor your academic journey with detailed analytics',
    image: require('../assets/images/intro3.jpg'), // Replace with your actual image
    color: '#3A4276',
  },
  {
    id: '4',
    title: 'Get Started',
    description: 'Join our community of learners and educators today',
    image: require('../assets/images/intro4.jpg'), // Replace with your actual image
    color: '#6C63FF',
  },
];

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
          <Text style={styles.splashText}>Vidyarthi</Text>
        </Animated.View>
      </View>
    );
  }

  // Render slide item
  const renderSlideItem = ({ item, index }: { item: typeof slides[0], index: number }) => {
    return (
      <View style={[styles.slide, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.slideImageContainer}>
          <Image source={item.image} style={styles.slideImage} resizeMode="contain" />
        </View>
        <View style={styles.slideTextContainer}>
          <Text style={[styles.slideTitle, { color: item.color }]}>{item.title}</Text>
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
          const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 16, 8],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          const backgroundColor = scrollX.interpolate({
            inputRange,
            outputRange: [
              '#B0B7C3',
              slides[index].color,
              '#B0B7C3',
            ],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index.toString()}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity,
                  backgroundColor,
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
      <StatusBar hidden />

      {/* Carousel */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlideItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
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

        {/* Get Started Button (only on last slide) */}
        {currentIndex === slides.length - 1 ? (
          <TouchableOpacity
            style={[styles.getStartedButton, { backgroundColor: slides[currentIndex].color }]}
            onPress={handleGetStarted}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              flatListRef.current?.scrollToIndex({
                index: slides.length - 1,
                animated: true,
              });
              setAutoScroll(false);
            }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
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
    color: '#3A4276',
  },
  slide: {
    width,
    height,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  slideImageContainer: {
    flex: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideImage: {
    width: width * 0.8,
    height: width * 0.8,
  },
  slideTextContainer: {
    flex: 0.4,
    alignItems: 'center',
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dotContainer: {
    flexDirection: 'row',
    marginBottom: 40,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  getStartedButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: '#8A94A6',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default IntroScreen;